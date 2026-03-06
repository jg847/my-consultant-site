const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_FIELDS = [
  "meta.name",
  "meta.title",
  "meta.tagline",
  "meta.email",
  "meta.linkedin",
  "hero.headline",
  "hero.subheadline",
  "hero.cta_text",
  "hero.cta_href",
  "services",
  "about.bio",
  "about.highlights",
  "contact.prompt",
  "contact.form_action"
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getNestedValue(data, keyPath) {
  return keyPath.split(".").reduce((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return current[key];
    }
    return undefined;
  }, data);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function renderServices(services) {
  return services
    .map(
      (service) =>
        `<li class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"><p class="text-2xl">${escapeHtml(service.icon)}</p><h3 class="mt-3 text-lg font-semibold text-[#1e3a5f]">${escapeHtml(service.title)}</h3><p class="mt-2 text-sm text-slate-600">${escapeHtml(service.description)}</p></li>`
    )
    .join("");
}

function renderHighlights(highlights) {
  const items = highlights
    .map((highlight) => `<li class="text-slate-700">${escapeHtml(highlight)}</li>`)
    .join("");
  return `<ul class="list-disc space-y-2 pl-5">${items}</ul>`;
}

function renderTemplate(template, data) {
  return template.replace(/{{\s*([^}]+?)\s*}}/g, (_, rawKey) => {
    const key = String(rawKey).trim();

    if (key === "services") {
      const services = getNestedValue(data, "services");
      return Array.isArray(services) ? renderServices(services) : "";
    }

    if (key === "about.highlights") {
      const highlights = getNestedValue(data, "about.highlights");
      return Array.isArray(highlights) ? renderHighlights(highlights) : "";
    }

    const value = getNestedValue(data, key);
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return escapeHtml(value);
    }

    return "";
  });
}

function assertRequiredField(content, fieldPath) {
  const value = getNestedValue(content, fieldPath);
  if (value === undefined || value === null) {
    throw new Error(`Missing required field: ${fieldPath}`);
  }
  if (typeof value === "string" && value.trim().length === 0) {
    throw new Error(`Missing required field: ${fieldPath}`);
  }
}

function validateContent(content) {
  for (const fieldPath of REQUIRED_FIELDS) {
    assertRequiredField(content, fieldPath);
  }

  const services = getNestedValue(content, "services");
  if (!Array.isArray(services) || services.length === 0) {
    throw new Error("Missing required field: services");
  }

  services.forEach((service, index) => {
    const requiredServiceFields = ["id", "title", "description", "icon"];
    for (const field of requiredServiceFields) {
      if (!service || typeof service !== "object" || !isNonEmptyString(service[field])) {
        throw new Error(`Missing required field: services[${index}].${field}`);
      }
    }
  });

  const highlights = getNestedValue(content, "about.highlights");
  if (!Array.isArray(highlights) || highlights.length === 0) {
    throw new Error("Missing required field: about.highlights");
  }
}

function generateSite(contentPath, outputPath) {
  if (!fs.existsSync(contentPath)) {
    throw new Error(`Content file not found: ${contentPath}`);
  }

  let content;
  try {
    const contentRaw = fs.readFileSync(contentPath, "utf-8");
    content = JSON.parse(contentRaw);
  } catch {
    throw new Error(`Invalid JSON in content file: ${contentPath}`);
  }

  validateContent(content);

  const templatePath = path.resolve(__dirname, "template.html");
  const template = fs.readFileSync(templatePath, "utf-8");
  const html = renderTemplate(template, content);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, "utf-8");

  const relativeOutput = path.relative(process.cwd(), outputPath).replaceAll("\\", "/");
  console.log(`✅ Site generated: ${relativeOutput}`);
}

if (require.main === module) {
  const defaultContentPath = path.resolve(process.cwd(), "content.json");
  const defaultOutputPath = path.resolve(process.cwd(), "docs", "index.html");
  generateSite(defaultContentPath, defaultOutputPath);
}

module.exports = {
  renderTemplate,
  generateSite
};