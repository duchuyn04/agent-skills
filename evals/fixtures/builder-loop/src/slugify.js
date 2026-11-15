// Đổi tiêu đề thành slug dùng trong URL.
export function slugify(text) {
  return text.toLowerCase().trim().replace(/\s+/g, '-');
}
