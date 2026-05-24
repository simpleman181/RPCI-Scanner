import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = "simpleman181/RPCI-Scanner";
const FILE_PATH = "public/stocks.json";
const BRANCH = "main";
const GITHUB_API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

// GET: fetch current stocks list
export async function GET() {
  try {
    const res = await fetch(GITHUB_API, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json();
    const content = JSON.parse(Buffer.from(data.content, "base64").toString());
    return NextResponse.json({ ...content, sha: data.sha });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: save updated stocks list back to GitHub
export async function POST(request: NextRequest) {
  try {
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GITHUB_TOKEN not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { symbols, fno, sha } = body;

    if (!symbols || !fno || !sha) {
      return NextResponse.json({ error: "Missing symbols, fno, or sha" }, { status: 400 });
    }

    const stocksData = { symbols, fno };
    const newContent = Buffer.from(JSON.stringify(stocksData, null, 2) + "\n").toString("base64");

    const res = await fetch(GITHUB_API, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "chore: update stocks list via admin UI",
        content: newContent,
        sha,
        branch: BRANCH,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "GitHub write failed");
    }

    const result = await res.json();
    return NextResponse.json({ success: true, sha: result.content.sha });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
