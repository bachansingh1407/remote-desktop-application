const axios = require("axios");

const prisma = require("../config/db");
const ApiError = require("../utils/ApiError");
const { NODE_TYPES } = require("../constants");
const storageService = require("./storage.service");

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get a node belonging to the authenticated owner.
 */
async function getNodeOrThrow(id, ownerId) {
  const node = await prisma.node.findFirst({
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

async function getDownloadInfo(
  id,
  ownerId
) {
  const node = await getNodeOrThrow(
    id,
    ownerId
  );

  if (!node.storagePath) {
    throw ApiError.notFound(
      "File not found"
    );
  }

  return {
    storagePath: node.storagePath,
    name: node.name,
    mimeType: node.mimeType,
  };
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

  getDownloadInfo,
  getNodeOrThrow,
};