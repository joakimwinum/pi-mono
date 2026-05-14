import { afterEach, describe, expect, it } from "vitest";
import type { LoadedResourcesSnapshot, ResourceLoader, SourceInfo } from "../../../src/index.js";
import { createTestExtensionsResult } from "../../utilities.js";
import { createHarness, type Harness } from "../harness.js";

describe("regression #4239: loaded resource snapshot", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("exposes loaded resources through pi and ctx APIs", async () => {
		let piSnapshot: LoadedResourcesSnapshot | undefined;
		let ctxSnapshot: LoadedResourcesSnapshot | undefined;

		const sourceInfo: SourceInfo = {
			path: "/project/.pi/skills/example/SKILL.md",
			source: "local",
			scope: "project",
			origin: "top-level",
			baseDir: "/project/.pi/skills/example",
		};

		const extensionsResult = await createTestExtensionsResult([
			{
				path: "/project/.pi/extensions/snapshot.ts",
				factory: (pi) => {
					pi.registerCommand("snapshot", {
						description: "Capture loaded resources",
						handler: async (_args, ctx) => {
							piSnapshot = pi.getResources();
							ctxSnapshot = ctx.getResources();
						},
					});
				},
			},
		]);

		const resourceLoader: ResourceLoader = {
			getExtensions: () => extensionsResult,
			getSkills: () => ({
				skills: [
					{
						name: "example",
						description: "Example skill",
						filePath: "/project/.pi/skills/example/SKILL.md",
						baseDir: "/project/.pi/skills/example",
						disableModelInvocation: false,
						sourceInfo,
					},
				],
				diagnostics: [],
			}),
			getPrompts: () => ({
				prompts: [
					{
						name: "review",
						description: "Review code",
						argumentHint: "focus",
						content: "Review $ARGUMENTS",
						filePath: "/project/.pi/prompts/review.md",
						sourceInfo: {
							...sourceInfo,
							path: "/project/.pi/prompts/review.md",
							baseDir: "/project/.pi/prompts",
						},
					},
				],
				diagnostics: [
					{
						type: "warning",
						message: "prompt warning",
						path: "/project/.pi/prompts/review.md",
					},
				],
			}),
			getThemes: () => ({ themes: [], diagnostics: [] }),
			getAgentsFiles: () => ({
				agentsFiles: [{ path: "/project/AGENTS.md", content: "Project instructions" }],
			}),
			getSystemPrompt: () => undefined,
			getAppendSystemPrompt: () => [],
			extendResources: () => {},
			reload: async () => {},
		};

		const harness = await createHarness({ resourceLoader });
		harnesses.push(harness);
		await harness.session.bindExtensions({});

		await harness.session.prompt("/snapshot");

		expect(piSnapshot).toBeDefined();
		expect(ctxSnapshot).toBeDefined();
		expect(piSnapshot).toEqual(ctxSnapshot);
		expect(piSnapshot?.contextFiles).toEqual([{ path: "/project/AGENTS.md", content: "Project instructions" }]);
		expect(piSnapshot?.skills[0]?.name).toBe("example");
		expect(piSnapshot?.prompts[0]).toMatchObject({ name: "review", argumentHint: "focus" });
		expect(piSnapshot?.extensions[0]).toMatchObject({ path: "/project/.pi/extensions/snapshot.ts" });
		expect(piSnapshot?.diagnostics.prompts[0]).toMatchObject({ message: "prompt warning" });
		expect(Object.isFrozen(piSnapshot)).toBe(true);
		expect(Object.isFrozen(piSnapshot?.skills)).toBe(true);
		expect(Object.isFrozen(piSnapshot?.skills[0])).toBe(true);
	});
});
