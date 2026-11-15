# Hồ sơ builder loop

## Builder

Loại agent: `claude`.

## Tiêu chí task

Tiêu chí nằm trong `tasks/todo.md`, tìm theo mã task.

## Phạm vi commit

`src/`, `tasks/`.

## Lệnh kiểm tra

Lệnh nhanh: `node --test src/`.

## Kiểm tự động

```json
{
  "scope": ["src/", "tasks/"],
  "criteria": ["tasks/todo.md"]
}
```
