import type { Core } from "@strapi/strapi"

const register = ({ strapi }: { strapi: Core.Strapi }) => {
	// add graphql resolver to extend the media files queries by adding a thumbnail field
	try {
		const extensionService = strapi.service("plugin::graphql.extension")

		// extend the UploadFile type with a thumbnail field
		extensionService.use({
			typeDefs: `
				extend type UploadFile {
					thumbnail: String
				}
			`,
			resolvers: {
				UploadFile: {
					thumbnail: {
						description: "Get thumbnail for a media file",
						resolve: (parent, args, context) => {
							const { id, url, ext } = parent

							if (ext !== ".mp4" && ext !== ".webm" && ext !== ".mov") {
								return null // Only generate thumbnails for video files
							}

							return strapi.plugin("video-thumbnails").service("service").generateThumbnail(url)
						},
					},
				},
			},
		})
	} catch (error) {
		strapi.log.error("Failed to register GraphQL resolver for video thumbnails:", error)
	}
}

export default register
