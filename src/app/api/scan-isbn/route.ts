// 扫码查书 API - 通过 ISBN 查询书籍信息
// 查询链：豆瓣 → Google Books → 京东 → 当当
import { NextRequest, NextResponse } from "next/server";
import { apiSuccess, apiError } from "@/lib/utils";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function stripTags(s: string) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url: string, ms = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

// 豆瓣查询：ISBN 重定向到详情页，解析 HTML
async function queryDouban(isbn: string) {
  try {
    const res = await fetchWithTimeout(`https://book.douban.com/isbn/${isbn}/`);
    if (!res.ok) return null;
    const html = await res.text();

    // info 区按 <br> 切分 HTML 片段后逐段去标签，保证"标签: 值"在同一逻辑行
    const infoHtml = html.match(/<div id="info">([\s\S]*?)<\/div>/)?.[1] || "";
    const lines = infoHtml
      .split(/<br\s*\/?>/i)
      .map((s) => stripTags(s))
      .filter(Boolean);
    const infoText = lines.join("\n");

    // 校验详情页 ISBN 与请求一致（在去标签文本上校验，防止重定向到错误/搜索页）
    if (!new RegExp(`ISBN[:：]\\s*${isbn}(?!\\d)`).test(infoText)) return null;

    const title = html.match(/property="v:itemreviewed">([^<]+)</)?.[1]?.trim() || "";
    if (!title) return null;

    let author = "";
    let publisher = "";
    for (const line of lines) {
      let m = line.match(/^(?:作者|译者)\s*[:：]\s*(.+)$/);
      if (m && !author) author = m[1].trim();
      m = line.match(/^出版社\s*[:：]\s*(.+)$/);
      if (m && !publisher) publisher = m[1].trim();
    }

    // 封面：主图链接（nbg 大图，退回 subject 小图）
    const coverUrl =
      html.match(/<a class="nbg"[^>]*href="([^"]+)"/)?.[1] ||
      html.match(/rel="v:image"[^>]*src="([^"]+)"/)?.[1] ||
      "";

    const ratingAvg = html.match(/rating_num[^>]*>\s*([0-9.]+)/)?.[1] || "";

    // 简介：第一个 intro 块内所有 <p> 文本
    const introHtml = html.match(/<div class="intro">([\s\S]*?)<\/div>/)?.[1] || "";
    const summary = stripTags(introHtml).slice(0, 300);

    return {
      title,
      author,
      publisher,
      coverUrl,
      isbn,
      summary,
      tags: [],
      rating: ratingAvg ? Number(ratingAvg) : null,
      source: "douban",
    };
  } catch (e) {
    console.error("豆瓣查询失败:", e);
    return null;
  }
}

// Google Books API：免费无需 Key，返回结构化 JSON
async function queryGoogleBooks(isbn: string) {
  try {
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const item = json?.items?.[0]?.volumeInfo;
    if (!item?.title) return null;
    // 封面缩略图（thumbnail 是 1px 边框小图，替换为 zoom=1 大图）
    let coverUrl = item.imageLinks?.thumbnail || item.imageLinks?.smallThumbnail || "";
    if (coverUrl) coverUrl = coverUrl.replace(/edge=curl/, "").replace(/zoom=\d/, "zoom=1");
    return {
      title: item.title.trim(),
      author: (item.authors || []).join(", "),
      publisher: item.publisher || "",
      coverUrl,
      isbn,
      summary: (item.description || "").slice(0, 300),
      tags: item.categories || [],
      rating: item.averageRating ? Number(item.averageRating) : null,
      source: "google",
    };
  } catch (e) {
    console.error("Google Books 查询失败:", e);
    return null;
  }
}

// 京东图书查询（备用）：搜索页 HTML 解析，中文绘本覆盖好
async function queryJd(isbn: string) {
  try {
    const res = await fetchWithTimeout(
      `https://search.jd.com/Search?keyword=${isbn}&enc=utf-8`,
    );
    if (!res.ok) return null;
    const html = await res.text();
    // 商品块：<li class="gl-item" ... data-sku="..."> 内含 <em>标题</em> 和封面 img
    const block = html.match(/<li class="gl-item"[\s\S]*?<\/li>/)?.[0] || "";
    if (!block) return null;
    // 标题：em 标签内的文本（去标签后拼接）
    const titleRaw = block.match(/<em[\s\S]*?<\/em>/)?.[0] || "";
    const title = stripTags(titleRaw);
    if (!title) return null;
    // 封面：data-lazy-img 或 src
    const coverUrl =
      block.match(/data-lazy-img="([^"]+)"/)?.[1] ||
      block.match(/<img[^>]+src="([^"]+)"[^>]*width=/)?.[1] ||
      "";
    return {
      title,
      author: "",
      publisher: "",
      coverUrl,
      isbn,
      summary: "",
      tags: [],
      rating: null,
      source: "jd",
    };
  } catch (e) {
    console.error("京东查询失败:", e);
    return null;
  }
}

// 当当查询（备用）：搜索页取第一个商品标题（页面为 GBK 编码）
async function queryDangdang(isbn: string) {
  try {
    const res = await fetchWithTimeout(`http://search.dangdang.com/?key=${isbn}`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const html = new TextDecoder("gbk").decode(buf);
    const item =
      html.match(/<a[^>]+title="([^"]+)"[^>]+href="(?:https?:)?\/\/product\.dangdang\.com\/(\d+)\.html"/) ||
      html.match(/<a[^>]+href="(?:https?:)?\/\/product\.dangdang\.com\/(\d+)\.html"[^>]*title="([^"]+)"/);
    if (!item) return null;
    const title = (item[1] || "").trim();
    if (!title) return null;
    return {
      title,
      author: "",
      publisher: "",
      coverUrl: "",
      isbn,
      summary: "",
      tags: [],
      rating: null,
      source: "dangdang",
    };
  } catch (e) {
    console.error("当当查询失败:", e);
    return null;
  }
}

// GET: 通过 ISBN 查询书籍信息
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isbn = searchParams.get("isbn");

    if (!isbn) {
      return NextResponse.json(apiError("ISBN 不能为空"), { status: 400 });
    }

    // 查询链：豆瓣 → Google Books → 京东 → 当当
    let info = await queryDouban(isbn);
    if (!info) info = await queryGoogleBooks(isbn);
    if (!info) info = await queryJd(isbn);
    if (!info) info = await queryDangdang(isbn);

    if (!info) {
      return NextResponse.json(
        apiSuccess({ isbn, found: false }, "未找到该书信息，请手动录入"),
      );
    }

    return NextResponse.json(apiSuccess({ ...info, found: true }, "查询成功"));
  } catch (error) {
    console.error("扫码查询失败:", error);
    return NextResponse.json(apiError("扫码查询失败"), { status: 500 });
  }
}
