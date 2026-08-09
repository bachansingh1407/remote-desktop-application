const ImageKit = require("imagekit");
const env = require("../config/env");

const imagekit = new ImageKit({
    publicKey: env.imagekit.publicKey,
    privateKey: env.imagekit.privateKey,
    urlEndpoint: env.imagekit.urlEndpoint,
});

async function uploadFile(file, userId) {
    const response = await imagekit.upload({
        file: file.buffer,
        fileName: file.originalname,
        folder: `/${env.imagekit.folder}/users/${userId}`,
        useUniqueFileName: true,
    });

    return response;
}

async function deleteFile(fileId) {
    return imagekit.deleteFile(fileId);
}

module.exports = {
    uploadFile,
    deleteFile,
};