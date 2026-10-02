/** Regenerates schema.json and the agent skill docs from the vocabulary so they never drift. Runs as part of the build. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildSchema } from "../src/schema";
import { FORMAT_MD, SKILL_MD, exampleMd, vocabularyMd } from "../src/skill";
import { PLAYS_MD, THINK_MD } from "../src/think";

const OUT = "skills/flowchart";
mkdirSync(`${OUT}/references`, { recursive: true });
writeFileSync(`${OUT}/SKILL.md`, SKILL_MD);
writeFileSync(`${OUT}/references/vocabulary.md`, vocabularyMd());
writeFileSync(`${OUT}/references/format.md`, FORMAT_MD);
writeFileSync(`${OUT}/references/schema.json`, JSON.stringify(buildSchema(), null, 2) + "\n");
writeFileSync(`${OUT}/references/example.md`, exampleMd(readFileSync("examples/late-order.flowchart.json", "utf8")));
// the second skill: /low-fi-think, which plans the thinking and uses all three kits
const THINK = "skills/low-fi-think";
mkdirSync(`${THINK}/references`, { recursive: true });
writeFileSync(`${THINK}/SKILL.md`, THINK_MD);
writeFileSync(`${THINK}/references/plays.md`, PLAYS_MD);
console.log(`wrote ${OUT}/SKILL.md + references/, ${THINK}/SKILL.md + references/`);
