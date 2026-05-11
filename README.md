# Aura — Music Player

Dark, luxurious web music player. Pure HTML/CSS/JS, deployed on Vercel, powered by Supabase.

---

## Setup rápido

### 1. Criar projeto no Supabase

Vai a [supabase.com](https://supabase.com), cria um novo projeto gratuito e aguarda a inicialização.

---

### 2. Criar a tabela `tracks`

No Supabase, abre **SQL Editor** e executa:

```sql
create table tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default 'Desconhecido',
  filename text not null,
  storage_path text not null,
  public_url text not null,
  duration integer,
  position integer not null default 0,
  cover_url text,
  created_at timestamptz default now()
);
alter table tracks enable row level security;
create policy "public read"    on tracks for select using (true);
create policy "service insert" on tracks for insert with check (true);
create policy "service update" on tracks for update using (true) with check (true);
create policy "service delete" on tracks for delete using (true);
```

---

### 3. Criar o bucket de storage

Em **Storage → New bucket**:
- Nome: `music`
- Visibilidade: **Public** (ativa "Public bucket")
- Clica em **Create bucket**

---

### 4. Configurar `config.js`

Copia o ficheiro de exemplo:

```
cp config.example.js config.js
```

Abre `config.js` e preenche as três variáveis:

```js
const SUPABASE_URL   = 'https://xxxx.supabase.co';      // Settings → API → Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJ...';             // Settings → API → anon public key
const ADMIN_PASSWORD = 'a-tua-password-segura';
```

> **Nota de segurança:** `config.js` está no `.gitignore` e nunca é commitado. No entanto, quando fizeres deploy no Vercel, o ficheiro é servido como estático — qualquer pessoa pode descarregá-lo e obter a `SUPABASE_ANON_KEY`. As políticas RLS do Supabase permitem escrita anónima por design (para simplificar). Para produção com dados sensíveis, considera adicionar autenticação real.

---

### 5. Push para GitHub

```bash
git init
git add .
git commit -m "feat: Aura music player"
git remote add origin https://github.com/teu-user/aura.git
git push -u origin main
```

`config.js` não será incluído (está no `.gitignore`).

---

### 6. Deploy no Vercel

1. Vai a [vercel.com](https://vercel.com) e clica em **Add New Project**
2. Importa o repositório GitHub
3. Clica em **Deploy** (sem configuração extra necessária)
4. Após o deploy, vai a **Settings → Environment Variables** se precisares de variáveis de ambiente (opcional — neste projeto as credenciais ficam em `config.js` servido como estático)

---

### 7. Adicionar `config.js` ao Vercel

Como `config.js` não está no git, tens duas opções:

**Opção A — Upload manual (mais simples):**
Depois do deploy, usa a Vercel CLI para fazer override do ficheiro:
```bash
npm i -g vercel
vercel login
vercel --prod
```
Coloca `config.js` na raiz antes de correr o comando para que seja incluído no deploy.

**Opção B — Variáveis de ambiente + script de build:**
Cria um `build.sh` que gera `config.js` a partir de variáveis de ambiente do Vercel. Mais seguro para projetos públicos.

---

### 8. Abrir o Admin e adicionar músicas

Navega para `https://teu-dominio.vercel.app/admin`, insere a password e começa a arrastar MP3s.

---

## Formato dos nomes de ficheiro

O admin extrai automaticamente artista e título do nome do ficheiro:

| Ficheiro                        | Título            | Artista    |
|---------------------------------|-------------------|------------|
| `Daft Punk - Get Lucky.mp3`     | Get Lucky         | Daft Punk  |
| `bohemian_rhapsody.mp3`         | bohemian_rhapsody | Desconhecido |
| `Billie Eilish - Happier Than Ever.mp3` | Happier Than Ever | Billie Eilish |

Se o ficheiro tiver tags ID3 com cover art, a capa é extraída e guardada automaticamente.

---

## Atalhos de teclado (player)

| Tecla       | Ação              |
|-------------|-------------------|
| `Espaço`    | Play / Pausa      |
| `←`         | Recuar 5 segundos |
| `→`         | Avançar 5 segundos|
| `↑`         | Volume +10%       |
| `↓`         | Volume -10%       |

---

## Estrutura do projeto

```
Aura/
├── index.html           # Player público
├── admin.html           # Painel de upload (protegido por password)
├── config.js            # Credenciais (não commitado — cria a partir do .example)
├── config.example.js    # Template de configuração
├── vercel.json          # Rewrite: /admin → /admin.html
├── .gitignore           # Ignora config.js
└── README.md
```

---

## Stack

- **Frontend:** HTML + CSS + JS puro (sem frameworks, sem npm)
- **Backend:** [Supabase](https://supabase.com) (Postgres + Storage)
- **Deploy:** [Vercel](https://vercel.com)
- **CDNs usados:**
  - `@supabase/supabase-js@2` via jsDelivr
  - `jsmediatags@3.9.5` via cdnjs (leitura de tags ID3 no admin)
  - Google Fonts — Syne
