import type { Core } from "@strapi/strapi"

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
	index(ctx) {
		ctx.body = "Welcome to Strapi 🚀"
	},
})

export default controller
