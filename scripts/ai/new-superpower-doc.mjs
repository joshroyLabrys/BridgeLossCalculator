import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const [docType, ...rest] = argv;
  const options = {
    docType,
    title: '',
    slug: '',
    date: '',
    dryRun: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === '--title') {
      options.title = rest[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--slug') {
      options.slug = rest[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--date') {
      options.date = rest[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
  }

  return options;
}

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function getDateString(value) {
  if (value) {
    return value;
  }

  return new Date().toISOString().slice(0, 10);
}

function getTemplatePath(docType) {
  if (docType === 'plan') {
    return path.join(repoRoot, 'docs', 'superpowers', 'templates', 'plan-template.md');
  }

  if (docType === 'spec') {
    return path.join(repoRoot, 'docs', 'superpowers', 'templates', 'spec-template.md');
  }

  throw new Error('Document type must be "plan" or "spec".');
}

function getOutputPath(docType, date, slug) {
  const directory = docType === 'plan' ? 'plans' : 'specs';
  const filename = docType === 'plan' ? `${date}-${slug}.md` : `${date}-${slug}-design.md`;
  return path.join(repoRoot, 'docs', 'superpowers', directory, filename);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.docType) {
    throw new Error('Usage: node scripts/ai/new-superpower-doc.mjs <plan|spec> --title "Feature Name" [--slug slug] [--date YYYY-MM-DD] [--dry-run]');
  }

  if (!options.title) {
    throw new Error('Missing required --title value.');
  }

  const date = getDateString(options.date);
  const slug = options.slug ? toSlug(options.slug) : toSlug(options.title);

  if (!slug) {
    throw new Error('Could not derive a slug from the provided title.');
  }

  const templatePath = getTemplatePath(options.docType);
  const outputPath = getOutputPath(options.docType, date, slug);
  const template = await readFile(templatePath, 'utf8');
  const content = template
    .replaceAll('{{TITLE}}', options.title)
    .replaceAll('{{DATE}}', date)
    .replaceAll('{{SLUG}}', slug);

  if (options.dryRun) {
    process.stdout.write(`${outputPath}\n`);
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, { flag: 'wx' });
  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
