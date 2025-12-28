import { readTemplateStructureFromJson, saveTemplateStructureToJson } from "@/features/playground/libs/path-to-json";
import { db } from "@/lib/db";
import { templatePaths } from "@/lib/template";
import path from "path";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";

// Helper function to ensure valid JSON
function validateJsonStructure(data: unknown): boolean {
  try {
    JSON.parse(JSON.stringify(data)); // Ensures it's serializable
    return true;
  } catch (error) {
    console.error("Invalid JSON structure:", error);
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const param = await params;
  const id = param.id;

  if (!id) {
    return Response.json({ error: "Missing playground ID" }, { status: 400 });
  }

  const playground = await db.playground.findUnique({
    where: { id },
  });

  if (!playground) {
    return Response.json({ error: "Playground not found" }, { status: 404 });
  }

  const templateKey = playground.template as keyof typeof templatePaths;
  const templatePath = templatePaths[templateKey];

  if (!templatePath) {
    return Response.json({ error: "Invalid template" }, { status: 404 });
  }

  try {
    const inputPath = path.join(process.cwd(), templatePath);
    const outputFile = path.join(process.cwd(), `output/${templateKey}.json`);

    console.log("Input Path:", inputPath);
    console.log("Output Path:", outputFile);

    // Save and read the template structure
    await saveTemplateStructureToJson(inputPath, outputFile);
    const result = await readTemplateStructureFromJson(outputFile);

    // Validate the JSON structure before saving
    if (!validateJsonStructure(result.items)) {
      return Response.json({ error: "Invalid JSON structure" }, { status: 500 });
    }

    await fs.unlink(outputFile);

    return NextResponse.json({ success: true, templateJson: result });
  } catch (error) {
    const message = (error as Error)?.message ?? "Unknown error";
    // return a JSON error with an appropriate status (404 for missing dir, 500 otherwise)
    const status = message.includes("does not exist") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
  // app/api/template/[id]/route.ts

  async function GET() {
  return new Response("API updated at " + new Date().toISOString());
}

}


