# SaaS Starter — React + Supabase

A full-stack SaaS boilerplate built with **React**, **Vite**, and **Supabase**. Supports multi-tenant organizations, role-based access control, and an invite system with accept/decline flow.

---

## Features

- **Authentication** — Sign up, log in, log out via Supabase Auth
- **Organizations** — Create and manage multiple organizations
- **Roles** — Owner, Admin, Member, Viewer per organization
- **Invite System** — Invite users by email with accept/decline flow
- **Leave Organization** — Members can leave an org anytime
- **Role-based UI** — Invite form only visible to owners and admins
- **Country Selector** — Powered by the RestCountries public API
- **Toast Notifications** — Real-time feedback for every action
- **Row Level Security** — All data is secured per user via Supabase RLS

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Database | Supabase (with RLS) |
| Third Party API | RestCountries API |

---

## Project Structure

```
src/
├── App.jsx                        # Root — decides Login or Dashboard
├── supabaseClient.js              # Supabase client setup
├── components/
│   ├── CreateOrg.jsx              # Form to create an organization
│   ├── Invitations.jsx            # Pending invite notifications
│   ├── OrgPanel.jsx               # Side panel — members + invite
│   └── Toast.jsx                  # Toast notification component
├── hooks/
│   ├── useOrganizations.js        # Fetches user's organizations
│   └── useToast.js                # Controls toast notifications
└── pages/
    ├── Dashboard.jsx              # Main page after login
    └── Login.jsx                  # Sign up / Log in page
```

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | One profile per user — stores email |
| `organizations` | A company or team — has name, slug, country |
| `organization_members` | Bridge table — links users to orgs with a role |
| `invitations` | Pending/accepted/declined invites |

### Enums

| Enum | Values |
|------|--------|
| `org_role` | `owner`, `admin`, `member`, `viewer` |
| `invite_status` | `pending`, `accepted`, `declined` |

### Triggers

| Trigger | What it does |
|---------|-------------|
| `on_user_created` | Auto creates a profile row when a user signs up |
| `on_organization_created` | Auto adds the creator as `owner` in `organization_members` |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/saas-app.git
cd saas-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Run the SQL setup (see below)
3. Copy your project URL and anon key

### 4. Create environment variables

Create a `.env.local` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Run the app

```bash
npm run dev
```

---

## Supabase SQL Setup

Run these in your Supabase SQL Editor in order:

### Enums

```sql
create type org_role as enum ('owner', 'admin', 'member', 'viewer');
create type invite_status as enum ('pending', 'accepted', 'declined');
```

### Tables

```sql
create table profiles (
  id uuid primary key references auth.users(id),
  email text,
  created_at timestamptz default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null default '',
  country text,
  created_at timestamptz default now()
);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role org_role not null default 'member',
  created_at timestamptz default now(),
  unique(org_id, user_id)
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  invited_by uuid references profiles(id) on delete cascade,
  invited_user_id uuid references profiles(id) on delete cascade,
  status invite_status not null default 'pending',
  created_at timestamptz default now(),
  unique(org_id, invited_user_id)
);
```

### Row Level Security

```sql
-- Profiles
alter table profiles enable row level security;

create policy "Users can view their own profile"
on profiles for select using (auth.uid() = id);

create policy "Users can insert their own profile"
on profiles for insert with check (auth.uid() = id);

create policy "Authenticated users can search profiles by email"
on profiles for select using (auth.uid() is not null);

-- Organizations
alter table organizations enable row level security;

create policy "Members can view their organizations"
on organizations for select
using (
  exists (
    select 1 from organization_members
    where org_id = organizations.id
    and user_id = auth.uid()
  )
);

create policy "Authenticated users can create organizations"
on organizations for insert
with check (auth.uid() is not null);

-- Organization Members
alter table organization_members enable row level security;

create policy "Members can view other members in their org"
on organization_members for select
using (auth.uid() = user_id);

create policy "Owners and admins can invite members"
on organization_members for insert
with check (
  exists (
    select 1 from organization_members
    where org_id = organization_members.org_id
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  )
);

create policy "Users can join org via valid invite"
on organization_members for insert
with check (
  exists (
    select 1 from invitations
    where invitations.org_id = organization_members.org_id
    and invitations.invited_user_id = auth.uid()
    and invitations.status = 'pending'
  )
);

create policy "Members can leave an organization"
on organization_members for delete
using (user_id = auth.uid() and role != 'owner');

-- Invitations
alter table invitations enable row level security;

create policy "Users can view their own invites"
on invitations for select
using (invited_user_id = auth.uid() or invited_by = auth.uid());

create policy "Owners and admins can create invites"
on invitations for insert
with check (
  exists (
    select 1 from organization_members
    where org_id = invitations.org_id
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  )
);

create policy "Users can update their own invites"
on invitations for update
using (invited_user_id = auth.uid());

create policy "Members can delete their own invite on leave"
on invitations for delete
using (invited_user_id = auth.uid());

create policy "Owners can delete invites in their org"
on invitations for delete
using (
  exists (
    select 1 from organization_members
    where org_id = invitations.org_id
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  )
);

create policy "Owners can view invites they sent"
on invitations for select
using (invited_by = auth.uid());
```

### Triggers

```sql
-- Auto create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_user_created
after insert on auth.users
for each row execute procedure handle_new_user();

-- Auto add creator as owner
create or replace function handle_new_organization()
returns trigger as $$
begin
  insert into organization_members (org_id, user_id, role)
  values (new.id, auth.uid(), 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_organization_created
after insert on organizations
for each row execute procedure handle_new_organization();
```

---

## How It Works

### Creating an Organization
1. User fills in name, slug, and country
2. Row inserted into `organizations`
3. Trigger fires and adds user as `owner` in `organization_members`

### Inviting a Member
1. Owner enters email in the org panel
2. App looks up the user in `profiles`
3. A `pending` invite is created in `invitations`
4. Invited user sees the invite on their dashboard

### Accepting an Invite
1. User clicks Accept
2. They are added to `organization_members` with role `member`
3. Invite status updated to `accepted`

### Leaving an Organization
1. Member clicks Leave
2. Their row is deleted from `organization_members`
3. Their invite row is deleted so they can be re-invited

---

## Third Party API

This project uses the [RestCountries API](https://restcountries.com) to populate the country dropdown when creating an organization. No API key required.

---

## License

MIT