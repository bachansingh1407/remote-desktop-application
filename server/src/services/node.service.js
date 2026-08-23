const axios = require("axios");
const archiver = require("archiver");

const prisma = require("../config/db");
const ApiError = require("../utils/ApiError");
const { NODE_TYPES } = require("../constants");
const storageService = require("./storage.service");

// Every listing/tree/search/trash endpoint below intentionally omits
// `content`. The frontend never reads it off these payloads — file bodies
// are fetched separately, on demand, when a file is actually opened (see
// fetchFileText/fetchFileDataUrl on the frontend, which hit /:id/download).
// Pulling full text content for every node on every tree/list/search
// query was dead weight on the wire and in Postgres — for a workspace
// with a handful of sizeable text files this alone measurably slows down
// "APIs feel slow" on every navigation, not just file open.
const LIST_SELECT = {
  id: true,
  type: true,
  name: true,
  mimeType: true,
  size: true,
  storagePath: true,
  thumbnailUrl: true,
  trashed: true,
  trashedAt: true,
  originalParentId: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  parentId: true,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get a node belonging to the authenticated owner.
 */
async function getNodeOrThrow(id, ownerId) {  const node = await prisma.node.findFirst({
    where: {
      id,
      ownerId,
    },
  });

  if (!node) {
    throw ApiError.notFound("Item not found");
  }

  return node;
}

/**
 * Returns every node in a subtree.
 *
 * IMPORTANT:
 * The Prisma schema currently defines IDs as:
 *
 *   String @id @default(uuid())
 *
 * without @db.Uuid.
 *
 * Therefore PostgreSQL stores these columns as TEXT.
 *
 * DO NOT cast the values to ::uuid here.
 *
 * Previous broken query:
 *
 *   id = ${rootId}::uuid
 *
 * This caused:
 *
 *   operator does not exist: text = uuid
 *
 * This implementation keeps everything as TEXT so it matches
 * the current Prisma/database schema.
 */
async function getSubtreeIds(rootId, ownerId) {
  const rows = await prisma.$queryRaw`
    WITH RECURSIVE subtree AS (
      SELECT
        id,
        "parentId",
        "ownerId",
        0 AS depth
      FROM nodes
      WHERE
        id = ${rootId}
        AND "ownerId" = ${ownerId}

      UNION ALL

      SELECT
        n.id,
        n."parentId",
        n."ownerId",
        s.depth + 1
      FROM nodes n
      INNER JOIN subtree s
        ON n."parentId" = s.id
       AND n."ownerId" = s."ownerId"
    )
    SELECT
      id,
      "parentId",
      depth
    FROM subtree
    ORDER BY depth ASC;
  `;

  return rows;
}

/**
 * Validate a parent folder.
 *
 * null / undefined means workspace root.
 */
async function assertFolderAndUsable(parentId, ownerId) {
  if (parentId === null || parentId === undefined) {
    return null;
  }

  const parent = await getNodeOrThrow(parentId, ownerId);

  if (parent.type !== NODE_TYPES.FOLDER) {
    throw ApiError.badRequest("Target parent is not a folder");
  }

  if (parent.trashed) {
    throw ApiError.badRequest(
      "Cannot use a trashed folder as a destination"
    );
  }

  return parent;
}

/**
 * Delete uploaded files from ImageKit (the actual storage backend — see
 * storage.service.js). Takes ImageKit file IDs, not storagePath URLs:
 * ImageKit's delete API is keyed by fileId, not by the public URL.
 *
 * Intentionally tolerant: if a file was already removed (or the id is
 * stale), deletion continues for the rest of the batch instead of
 * failing the whole trash/delete operation.
 */
async function deleteFilesFromStorage(imagekitFileIds) {
  await Promise.all(
    imagekitFileIds
      .filter(Boolean)
      .map((fileId) => storageService.deleteFile(fileId).catch(() => {}))
  );
}

// ---------------------------------------------------------------------------
// Listing / reading
// ---------------------------------------------------------------------------

/**
 * List direct children of a folder.
 *
 * parentId:
 *   undefined / "null" -> workspace root
 *   UUID string        -> children of that folder
 */
async function listChildren(ownerId, parentId) {
  const normalizedParentId =
    parentId === "null" || parentId === undefined
      ? null
      : parentId;

  if (normalizedParentId) {
    await assertFolderAndUsable(normalizedParentId, ownerId);
  }

  return prisma.node.findMany({
    where: {
      ownerId,
      trashed: false,
      parentId: normalizedParentId,
    },
    orderBy: [
      { type: "asc" },
      { name: "asc" },
    ],
    select: LIST_SELECT,
  });
}

/**
 * Return only the visible roots of trash subtrees.
 *
 * Example:
 *
 * Folder A
 *   ├── File 1
 *   └── Folder B
 *
 * If Folder A was trashed, trash contains only Folder A,
 * not all of its descendants.
 */
async function listTrash(ownerId) {
  const trashedNodes = await prisma.node.findMany({
    where: {
      ownerId,
      trashed: true,
    },
    orderBy: {
      trashedAt: "desc",
    },
    select: LIST_SELECT,
  });

  const trashedIds = new Set(
    trashedNodes.map((node) => node.id)
  );

  return trashedNodes.filter(
    (node) =>
      !node.parentId ||
      !trashedIds.has(node.parentId)
  );
}

/**
 * Search non-trashed nodes by name.
 */
async function searchNodes(ownerId, query) {
  return prisma.node.findMany({
    where: {
      ownerId,
      trashed: false,
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 50,
    select: LIST_SELECT,
  });
}

/**
 * Build the path from workspace root to a node.
 *
 * This uses a recursive CTE, but unlike the old implementation
 * it DOES NOT cast TEXT IDs to UUID.
 */
async function getPath(ownerId, id) {
  const rows = await prisma.$queryRaw`
    WITH RECURSIVE ancestors AS (
      SELECT
        id,
        "parentId",
        "ownerId",
        name,
        type,
        0 AS depth
      FROM nodes
      WHERE
        id = ${id}
        AND "ownerId" = ${ownerId}

      UNION ALL

      SELECT
        n.id,
        n."parentId",
        n."ownerId",
        n.name,
        n.type,
        a.depth + 1
      FROM nodes n
      INNER JOIN ancestors a
        ON n.id = a."parentId"
       AND n."ownerId" = a."ownerId"
    )
    SELECT
      id,
      name,
      type
    FROM ancestors
    ORDER BY depth DESC;
  `;

  if (rows.length === 0) {
    throw ApiError.notFound("Item not found");
  }

  return rows;
}

/**
 * Return every node belonging to the owner.
 *
 * Used by the frontend to hydrate the complete local filesystem cache.
 */
async function getFullTree(ownerId) {
  // NOTE: unlike listChildren/searchNodes/listTrash below, this one keeps
  // `content` in the select. The frontend's only hydration call
  // (`useFileSystemStore.hydrate()`) hits this endpoint once and then
  // treats the result as the synchronous source of truth for every node
  // — FileEditor, CodeFileEditor, WriteApp, and the storage-usage
  // calculation in Settings all read `item.content` straight out of that
  // cache with no separate fetch. Trimming it here silently blanks out
  // every text file's content in the editor and would let autosave
  // overwrite real content with "" on next edit. If a future endpoint
  // consumer only needs metadata, use listChildren/searchNodes instead —
  // both already omit content and are safe to trim further.
  return prisma.node.findMany({
    where: {
      ownerId,
    },
    orderBy: [
      { type: "asc" },
      { name: "asc" },
    ],
  });
}

/**
 * Workspace statistics.
 */
async function getWorkspaceStats(ownerId) {
  const [
    totalFiles,
    totalFolders,
    trashedCount,
    sizeAgg,
  ] = await Promise.all([
    prisma.node.count({
      where: {
        ownerId,
        trashed: false,
        type: NODE_TYPES.FILE,
      },
    }),

    prisma.node.count({
      where: {
        ownerId,
        trashed: false,
        type: NODE_TYPES.FOLDER,
      },
    }),

    prisma.node.count({
      where: {
        ownerId,
        trashed: true,
      },
    }),

    prisma.node.aggregate({
      where: {
        ownerId,
        trashed: false,
        type: NODE_TYPES.FILE,
      },
      _sum: {
        size: true,
      },
    }),
  ]);

  return {
    totalFiles,
    totalFolders,
    trashedCount,
    totalSizeBytes: sizeAgg._sum.size || 0,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create folder.
 */
async function createFolder(ownerId, { parentId, name }) {
  await assertFolderAndUsable(parentId, ownerId);

  return prisma.node.create({
    data: {
      ownerId,
      parentId: parentId ?? null,
      type: NODE_TYPES.FOLDER,
      name,
    },
  });
}

/**
 * Create text file.
 */
async function createFile(
  ownerId,
  { parentId, name, content }
) {
  await assertFolderAndUsable(parentId, ownerId);

  const fileContent = content ?? "";

  return prisma.node.create({
    data: {
      ownerId,
      parentId: parentId ?? null,
      type: NODE_TYPES.FILE,
      name,
      content: fileContent,
      size: Buffer.byteLength(fileContent, "utf8"),
      mimeType: "text/plain",
    },
  });
}

/**
 * Upload/import file.
 */
async function importFile(ownerId, { parentId, file }) {
  await assertFolderAndUsable(parentId, ownerId);

  if (!file) {
    throw ApiError.badRequest("No file uploaded");
  }

  const uploaded = await storageService.uploadFile(
    file,
    ownerId
  );

  return prisma.node.create({
    data: {
      ownerId,
      parentId: parentId ?? null,
      type: NODE_TYPES.FILE,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,

      storagePath: uploaded.url,
      imagekitFileId: uploaded.fileId,
      thumbnailUrl: uploaded.thumbnailUrl,
    },
  });
}

/**
 * Update text file content.
 */
async function updateContent(id, ownerId, content) {
  const node = await getNodeOrThrow(id, ownerId);

  if (node.trashed) {
    throw ApiError.badRequest(
      "Cannot edit an item in the trash"
    );
  }

  if (node.type !== NODE_TYPES.FILE) {
    throw ApiError.badRequest(
      "Only files have content"
    );
  }

  return prisma.node.update({
    where: {
      id,
    },
    data: {
      content,
      size: Buffer.byteLength(content, "utf8"),
    },
  });
}

/**
 * Rename node.
 */
async function renameNode(id, ownerId, name) {
  const node = await getNodeOrThrow(id, ownerId);

  if (node.trashed) {
    throw ApiError.badRequest(
      "Restore this item before renaming it"
    );
  }

  return prisma.node.update({
    where: {
      id,
    },
    data: {
      name,
    },
  });
}

/**
 * Move node.
 */
async function moveNode(id, ownerId, newParentId) {
  const node = await getNodeOrThrow(id, ownerId);

  if (node.trashed) {
    throw ApiError.badRequest(
      "Restore this item before moving it"
    );
  }

  if (newParentId === id) {
    throw ApiError.badRequest(
      "Cannot move an item into itself"
    );
  }

  await assertFolderAndUsable(
    newParentId,
    ownerId
  );

  // Prevent moving a folder into itself or one of its
  // descendants.
  if (newParentId) {
    const subtree = await getSubtreeIds(
      id,
      ownerId
    );

    if (
      subtree.some(
        (node) => node.id === newParentId
      )
    ) {
      throw ApiError.badRequest(
        "Cannot move a folder into its own subtree"
      );
    }
  }

  return prisma.node.update({
    where: {
      id,
    },
    data: {
      parentId: newParentId ?? null,
    },
  });
}

/**
 * Duplicate node.
 */
async function duplicateNode(id, ownerId) {
  const node = await getNodeOrThrow(
    id,
    ownerId
  );

  if (node.trashed) {
    throw ApiError.badRequest(
      "Restore this item before duplicating it"
    );
  }

  let newStoragePath = null;
  let newImagekitFileId = null;
  let newThumbnailUrl = null;

  if (node.storagePath) {
    // Storage is ImageKit (remote), not local disk — "copying" a file
    // means downloading its bytes and re-uploading them as a new asset,
    // so trashing/deleting one copy can never orphan the other's pointer.
    try {
      const source = await axios.get(node.storagePath, {
        responseType: "arraybuffer",
      });

      const uploaded = await storageService.uploadFile(
        {
          buffer: Buffer.from(source.data),
          originalname: node.name,
          mimetype: node.mimeType || "application/octet-stream",
        },
        ownerId
      );

      newStoragePath = uploaded.url;
      newImagekitFileId = uploaded.fileId;
      newThumbnailUrl = uploaded.thumbnailUrl;
    } catch (error) {
      // Don't crash the entire duplication operation if the re-upload
      // fails (e.g. transient network issue) — the duplicate still gets
      // created, just without its own copy of the underlying file.
      newStoragePath = null;
      newImagekitFileId = null;
      newThumbnailUrl = null;
    }
  }

  return prisma.node.create({
    data: {
      ownerId,
      parentId: node.parentId,
      type: node.type,
      name: `${node.name} copy`,
      content: node.content,
      mimeType: node.mimeType,
      size: node.size,
      storagePath: newStoragePath,
      imagekitFileId: newImagekitFileId,
      thumbnailUrl: newThumbnailUrl,
    },
  });
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

/**
 * Move node + entire subtree to trash.
 *
 * Parent relationships are preserved so restore can reconstruct
 * the original tree.
 */
async function trashNode(id, ownerId) {
  const node = await getNodeOrThrow(
    id,
    ownerId
  );

  if (node.trashed) {
    throw ApiError.badRequest(
      "Item is already in the trash"
    );
  }

  const subtree = await getSubtreeIds(
    id,
    ownerId
  );

  const now = new Date();

  const descendantIds = subtree
    .map((item) => item.id)
    .filter((itemId) => itemId !== id);

  await prisma.$transaction([
    // Root node.
    prisma.node.update({
      where: {
        id,
      },
      data: {
        trashed: true,
        trashedAt: now,
        originalParentId: node.parentId,
      },
    }),

    // Descendants.
    ...(descendantIds.length > 0
      ? [
          prisma.node.updateMany({
            where: {
              id: {
                in: descendantIds,
              },
              ownerId,
            },
            data: {
              trashed: true,
              trashedAt: now,
            },
          }),
        ]
      : []),
  ]);

  return {
    trashedCount: subtree.length,
  };
}

/**
 * Restore a trashed node and its descendants.
 *
 * Root:
 *   - Restores to original parent if available.
 *   - Otherwise goes to workspace root.
 *
 * Descendants:
 *   - Restore if their parent is restored.
 */
async function restoreNode(id, ownerId) {
  const node = await getNodeOrThrow(
    id,
    ownerId
  );

  if (!node.trashed) {
    throw ApiError.badRequest(
      "Item is not in the trash"
    );
  }

  const subtree = await getSubtreeIds(
    id,
    ownerId
  );

  const subtreeNodes =
    await prisma.node.findMany({
      where: {
        id: {
          in: subtree.map(
            (item) => item.id
          ),
        },
        ownerId,
      },
    });

  const byId = new Map(
    subtreeNodes.map((item) => [
      item.id,
      item,
    ])
  );

  const willRestore = new Set();

  // Root always gets restored.
  willRestore.add(id);

  // Process children in depth order.
  for (const row of subtree) {
    if (row.id === id) {
      continue;
    }

    const current = byId.get(row.id);

    if (!current) {
      continue;
    }

    const parent = current.parentId
      ? byId.get(current.parentId)
      : null;

    if (!parent) {
      continue;
    }

    if (
      willRestore.has(parent.id) ||
      parent.trashed === false
    ) {
      willRestore.add(current.id);
    }
  }

  // Find the original parent.
  let resolvedParentId = null;

  if (node.originalParentId) {
    const originalParent =
      await prisma.node.findFirst({
        where: {
          id: node.originalParentId,
          ownerId,
          trashed: false,
        },
      });

    if (originalParent) {
      resolvedParentId =
        originalParent.id;
    }
  }

  const updates = [
    ...willRestore,
  ].map((nodeId) => {
    if (nodeId === id) {
      return prisma.node.update({
        where: {
          id: nodeId,
        },
        data: {
          trashed: false,
          trashedAt: null,
          originalParentId: null,
          parentId: resolvedParentId,
        },
      });
    }

    return prisma.node.update({
      where: {
        id: nodeId,
      },
      data: {
        trashed: false,
        trashedAt: null,
      },
    });
  });

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  return {
    restoredCount: updates.length,
  };
}

// ---------------------------------------------------------------------------
// Permanent deletion
// ---------------------------------------------------------------------------

/**
 * Permanently delete a node + its entire subtree.
 *
 * Only trashed nodes can be permanently deleted.
 */
async function deleteForever(id, ownerId) {
  const node = await getNodeOrThrow(
    id,
    ownerId
  );

  if (!node.trashed) {
    throw ApiError.badRequest(
      "Move this item to the trash before deleting it permanently"
    );
  }

  const subtree = await getSubtreeIds(
    id,
    ownerId
  );

  const ids = subtree.map(
    (item) => item.id
  );

  const filesToRemove =
    await prisma.node.findMany({
      where: {
        id: {
          in: ids,
        },
        ownerId,
        imagekitFileId: {
          not: null,
        },
      },
      select: {
        imagekitFileId: true,
      },
    });

  if (ids.length > 0) {
    await prisma.node.deleteMany({
      where: {
        id: {
          in: ids,
        },
        ownerId,
      },
    });
  }

  await deleteFilesFromStorage(
    filesToRemove.map(
      (file) => file.imagekitFileId
    )
  );

  return {
    deletedCount: ids.length,
  };
}

/**
 * Empty the entire trash for an owner.
 */
async function emptyTrash(ownerId) {
  const trashedNodes =
    await prisma.node.findMany({
      where: {
        ownerId,
        trashed: true,
      },
      select: {
        id: true,
        imagekitFileId: true,
      },
    });

  await prisma.node.deleteMany({
    where: {
      ownerId,
      trashed: true,
    },
  });

  await deleteFilesFromStorage(
    trashedNodes.map(
      (node) => node.imagekitFileId
    )
  );

  return {
    deletedCount: trashedNodes.length,
  };
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Describes how to serve a single node's download.
 *
 * Two kinds of FILE nodes exist:
 *   - "in-app" text files created via createFile/updateContent, which only
 *     ever have `content` (no storagePath). The old implementation only
 *     handled uploaded/ImageKit files and 404'd on these.
 *   - uploaded files, stored remotely on ImageKit, referenced by
 *     `storagePath` (a public URL).
 *
 * FOLDER nodes have no single-stream representation — the controller is
 * expected to route those through `buildZipEntries` instead.
 */
async function getDownloadDescriptor(id, ownerId) {
  const node = await getNodeOrThrow(id, ownerId);

  if (node.trashed) {
    throw ApiError.notFound("Item not found");
  }

  if (node.type === NODE_TYPES.FOLDER) {
    return { kind: "folder", node };
  }

  if (node.storagePath) {
    return {
      kind: "remote",
      name: node.name,
      mimeType: node.mimeType || "application/octet-stream",
      storagePath: node.storagePath,
    };
  }

  // In-app text file: no uploaded blob, just DB content.
  return {
    kind: "buffer",
    name: node.name,
    mimeType: node.mimeType || "text/plain; charset=utf-8",
    buffer: Buffer.from(node.content ?? "", "utf-8"),
  };
}

/**
 * Resolves a mixed list of node ids (files and/or folders, any depth) into
 * a flat list of zip entries: { relPath, node }. Folders contribute their
 * full (non-trashed) subtree, nested under the folder's own name so the
 * zip preserves the on-screen structure. Used for both a single-folder
 * download and a multi-select "download as zip" action.
 */
async function buildZipEntries(rootIds, ownerId) {
  const entries = [];

  for (const rootId of rootIds) {
    const rootNode = await getNodeOrThrow(rootId, ownerId);
    if (rootNode.trashed) {
      throw ApiError.notFound("Item not found");
    }

    if (rootNode.type === NODE_TYPES.FILE) {
      entries.push({ relPath: rootNode.name, node: rootNode });
      continue;
    }

    // FOLDER: pull the whole subtree in one recursive query, then rebuild
    // relative paths in memory instead of re-querying per level.
    const subtree = await getSubtreeIds(rootNode.id, ownerId);
    const ids = subtree.map((r) => r.id);
    const nodes = await prisma.node.findMany({
      where: { id: { in: ids }, trashed: false },
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const pathCache = new Map();
    function pathFor(node) {
      if (pathCache.has(node.id)) return pathCache.get(node.id);
      const p =
        node.id === rootNode.id
          ? rootNode.name
          : byId.has(node.parentId)
          ? `${pathFor(byId.get(node.parentId))}/${node.name}`
          : node.name;
      pathCache.set(node.id, p);
      return p;
    }

    let hasFile = false;
    for (const node of nodes) {
      if (node.type === NODE_TYPES.FILE) {
        hasFile = true;
        entries.push({ relPath: pathFor(node), node });
      }
    }
    // Empty folder (no files anywhere in the subtree) — still represent it
    // as a directory entry so the zip isn't just silently missing it.
    if (!hasFile) {
      entries.push({ relPath: `${rootNode.name}/`, node: null });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getFullTree,
  listChildren,
  listTrash,
  searchNodes,
  getPath,
  getWorkspaceStats,

  createFolder,
  createFile,
  importFile,
  updateContent,
  renameNode,
  moveNode,
  duplicateNode,

  trashNode,
  restoreNode,
  deleteForever,
  emptyTrash,

  getDownloadDescriptor,
  buildZipEntries,
  getNodeOrThrow,
};