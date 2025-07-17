import type { Core } from "@strapi/strapi";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import ffmpeg from "ffmpeg";


export interface VideoThumbnailOptions {
	thumbnailsPath?: string;
	thumbnailSize?: string;
	timeOffset?: string;
}


const service = ({ strapi }: { strapi: Core.Strapi }) => {
	const getConfig = () => {
		return strapi.config.get<VideoThumbnailOptions>("plugin::video-thumbnails");
	}

	return ({
		async generateThumbnail (fileUrl: string, options: VideoThumbnailOptions = {}) {
			const config = getConfig();

			const absoluteExportDir = path.join(strapi.dirs.static.public, config.thumbnailsPath);

			const absoluteVideoPath = path.join(strapi.dirs.static.public, fileUrl.replace(/^\//, ""));

			const ffmpegExportFileName = crypto.createHash("md5").update(fileUrl).digest("hex") + "_thumbnail.jpg";
			const ffmpegExportFilePath = path.join(absoluteExportDir, ffmpegExportFileName);

			const correctedExportFileName = crypto.createHash("md5").update(fileUrl).digest("hex") + "_thumbnail_1.jpg";
			const correctedExportFilePath = path.join(absoluteExportDir, correctedExportFileName);
			const publicFilePath = path.join("/", config.thumbnailsPath, correctedExportFileName);

			try {
				fs.accessSync(correctedExportFilePath);
				strapi.log.info(`Use cached thumbnail for video: ${ fileUrl }`);
				return publicFilePath;
			} catch (error) {
				strapi.log.info(`Thumbnail not found, generating new one for video: ${ fileUrl }`);
			}

			// Ensure thumbnails directory exists
			fs.mkdirSync(absoluteExportDir, { recursive: true });

			// Generate thumbnail using FFmpeg
			return new Promise((resolve, reject) => {
				console.log("Generating thumbnail for video:", absoluteVideoPath);

				new ffmpeg(absoluteVideoPath, (error, video) => {
					if (error) {
						strapi.log.error("FFmpeg error:", error);
						return reject(error);
					}

					video.fnExtractFrameToJPG(absoluteExportDir, {
						size: config.thumbnailSize || "1280x720",
						number: 1, // Extract only one frame
						file_name: ffmpegExportFileName,
						start_time: config.timeOffset || "00:00:01", // Start at 1 second
					}).then((image) => {
						console.log("FFmpeg generated frames:", image);

						if (image.length === 0) {
							strapi.log.error("FFmpeg did not generate any frames.");
							return reject(new Error("FFmpeg did not generate any frames."));
						}

						const thumbnail = fs.statSync(image[0]);

						if (thumbnail.size === 0) {
							strapi.log.error("Generated thumbnail is empty.");
							return reject(new Error("Generated thumbnail is empty."));
						}

						resolve(publicFilePath);
					}).catch((ffmpegError) => {
						strapi.log.error("FFmpeg error during thumbnail generation:", ffmpegError);
						reject(ffmpegError);
					})
				})
			});

			// const trackedTime = new Date();
			//
			// const config = strapi.config.get<VideoThumbnailOptions>("plugin::video-thumbnails");
			//
			// // Create hash from file URL for cache key
			// const fileUrlHash = crypto.createHash("md5").update(fileUrl).digest("hex");
			// const thumbnailFilename = `${ fileUrlHash }_thumbnail.jpg`;
			// const thumbnailPath = path.join(config.thumbnailsPath, thumbnailFilename);
			// // export file name must be different from thumbnail filename
			// // because ffmpeg adds a number to the end of the file name
			// const exportFileName = `${ fileUrlHash }_thumbnail_1.jpg`;
			// const thumbnailExportPath = path.join(strapi.dirs.static.public, config.thumbnailsPath, exportFileName);
			//
			// console.log("thumbnailExportPath", thumbnailExportPath, fs.existsSync(thumbnailExportPath));
			//
			// try {
			// 	// Check if thumbnail already exists
			// 	fs.accessSync(thumbnailExportPath);
			// 	strapi.log.info(`Use cached thumbnail for video: ${ fileUrl }`);
			// 	return `/${ exportFileName }`;
			// } catch (error) {
			// 	// Thumbnail doesn't exist, generate it
			// 	strapi.log.info(`Thumbnail not found, generating new one for video: ${ fileUrl }`);
			// }
			//
			// // Ensure thumbnails directory exists
			// fs.mkdirSync(config.thumbnailsPath, { recursive: true });
			//
			// // Generate thumbnail using FFmpeg
			// return new Promise((resolve, reject) => {
			// 	new ffmpeg(thumbnailExportPath, (err, video) => {
			// 		strapi.log.info(`Generating thumbnail for video: ${ fileUrl }`);
			//
			// 		if (err) {
			// 			strapi.log.error("FFmpeg error:", err);
			// 			return reject(err);
			// 		}
			//
			// 		console.log("thumbnailsPath hee", config.thumbnailsPath, thumbnailFilename);
			//
			// 		video.fnExtractFrameToJPG(config.thumbnailsPath, {
			// 			size: config.thumbnailSize,
			// 			number: 1, // Extract only one frame
			// 			file_name: thumbnailFilename,
			// 			start_time: config.timeOffset || "00:00:01", // Start at 1 second
			// 		}).then(((image) => {
			// 			if (image.length === 0) {
			// 				strapi.log.error("FFmpeg did not generate any frames.");
			// 				return reject(new Error("FFmpeg did not generate any frames."));
			// 			}
			//
			// 			console.log("thumbnailPath", image[0], fs.statSync(thumbnailPath).size);
			//
			// 			const thumbnailSize = fs.statSync(thumbnailPath).size;
			//
			// 			if (thumbnailSize === 0) {
			// 				strapi.log.error("Generated thumbnail is empty.");
			// 				return reject(new Error("Generated thumbnail is empty."));
			// 			}
			//
			// 			strapi.log.info(`Generated thumbnail ${ thumbnailPath } in ${ Date.now() - trackedTime.getTime() }ms`);
			//
			// 			resolve(`/${ exportFileName }`);
			// 		})).catch((ffmpegError) => {
			// 			strapi.log.error("FFmpeg error during thumbnail generation:", ffmpegError);
			// 			reject(ffmpegError);
			// 		});
			// 	});
			// });
		},

		async cleanupThumbnails () {
			const config = strapi.config.get<VideoThumbnailOptions>("plugin::video-thumbnails");
			const { thumbnailsPath } = config;

			try {
				const files = fs.readdirSync(thumbnailsPath);
				const now = Date.now();
				const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

				for (const file of files) {
					const filePath = path.join(thumbnailsPath, file);
					const stats = fs.statSync(filePath);

					if (now - stats.mtime.getTime() > maxAge) {
						fs.unlinkSync(filePath);
					}
				}
			} catch (error) {
				strapi.log.error("Error cleaning up thumbnails:", error);
			}
		},
	});
};

export default service;
