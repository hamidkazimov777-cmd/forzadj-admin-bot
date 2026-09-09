# AI_GUIDE.md — правила для ИИ-ассистентов (forzadj-admin-bot)

> **Читай ПЕРВЫМ, затем `HANDOFF.md`.** Оба — до любого изменения.
> Для любых ассистентов (Gemini, GPT/Codex, Kimi и т.д.).

## 0. Грабли, которые реально ломали бота

1. **Node 22, не 20.** Зависимость `undici@8` при старте вызывает
   `worker_threads.markAsUncloneable` — этого нет в Node 20 → краш
   «webidl.util.markAsUncloneable is not a function». Версия зафиксирована:
   `nixpacks.toml` (`NIXPACKS_NODE_VERSION="22"`), `.nvmrc`, `engines>=22`.
   Не понижай Node.
2. **Только ОДИН запущенный инстанс бота.** Два процесса с одним `BOT_TOKEN`
   поллят Telegram → `409 Conflict`, оба крашатся. Дом бота — **Railway**
   (сервис `forzadj-admin-bot`). НЕ запускай второй инстанс на VPS/локально
   параллельно с проданшеном.
3. **Всегда `git push` сразу после `git commit`.** Railway деплоит из GitHub;
   локальные незапушенные коммиты он не видит.
4. **`pendingStore` — чисто в памяти.** Любой рестарт/редеплой теряет
   незавершённые (неопубликованные) треки. Это by design; не считай это багом.

## 1. Процесс
- Read-first (этот файл + `HANDOFF.md`). Проверяй, что файлы/функции/поля
  существуют, прежде чем править. Не выдумывай API.
- Маленькими шагами, один concern на коммит. Повторяй существующие паттерны.
- Перед «готово»: `pnpm run build` (tsc) проходит; `pnpm install --frozen-lockfile`
  не падает; обнови `HANDOFF.md`. Не уверен — спроси.

## 2. Факты
- **Стек:** Node 22, grammY (long-polling), TypeScript, ffmpeg/ffprobe (ставится
  через `nixpacks.toml` `nixPkgs=["...","ffmpeg"]`), сборка `tsc → dist/`.
- **Пакетный менеджер на Railway — pnpm** (`railway.json` buildCommand). Держи
  `pnpm-lock.yaml` синхронным; не плоди конфликтующие lock-файлы.
- **AI:** `AI_PROVIDER=openrouter`, модель — google/gemini-2.5-flash **через
  OpenRouter** (это корректно; не «чини» на прямой gemini). Ключ —
  `OPENROUTER_API_KEY`. OpenRouter режет часть IP (напр. РФ) — если видишь
  403 «Access denied by security policy», это про регион/ключ, а не про код.
- **Публикация трека:** бот шлёт на сайт `POST /api/bot/upload` (заголовок
  `x-bot-secret` = `FORZADJ_BOT_SECRET` == сайтовый `BOT_UPLOAD_SECRET`).
  Логику публикации на сайте НЕ дублируй — она одна.
- **Сеть к сайту:** используется `undici` с `keepAliveTimeout:1` (свежее
  соединение на каждый publish) — обход «Unexpected end of JSON input» на
  переиспользованном keep-alive. Не заменяй на глобальный fetch.
- **Env (Railway → Variables):** `BOT_TOKEN`, `AI_PROVIDER`, `OPENROUTER_API_KEY`,
  `ALLOWED_TELEGRAM_IDS`, `FORZADJ_API_URL=https://forzadj.ru`, `FORZADJ_BOT_SECRET`.
  Секреты — только в Railway, никогда в код/git/логи.

## 3. Шаблон промта (человеку — в начало запроса ИИ)
```
Проект forzadj-admin-bot. Перед действием прочитай AI_GUIDE.md и HANDOFF.md и
следуй им. Node 22 (не понижать); один инстанс бота (иначе 409); AI через
OpenRouter→gemini — норм; всегда push после commit (Railway деплоит из GitHub);
перед «готово» — сборка tsc проходит и HANDOFF обновлён. Не выдумывай API,
работай маленькими шагами, не уверен — спроси.
Задача: <...>
```
