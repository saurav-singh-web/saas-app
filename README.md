# SaaS Starter — React + Supabase

A full-stack SaaS boilerplate built with **React**, **Vite**, and **Supabase**. Supports multi-tenant organizations, role-based access control, and an invite system with accept/decline flow.

---

## Features

- **Authentication** — Sign up, log in, log out via Supabase Auth, including Google OAuth
- **Organizations** — Create and manage multiple organizations, with the ability for owners to transfer ownership and delete organizations
- **Roles** — Owner, Admin, Member, Viewer, Content Maker, and Team Leader per organization
- **Invite System** — Invite users by email with accept/decline flow
- **Leave Organization** — Members can leave an org anytime
- **Role-based UI** — Granular permissions for every action based on role
- **Country Selector** — Powered by the RestCountries public API
- **Toast Notifications** — Real-time feedback for every action
- **Row Level Security** — All data is secured per user via Supabase RLS
- **Posts System** — Create, approve, edit, and delete posts within organizations
- **Post Interactions** — Like and comment on posts
- **Public Feed** — Anyone can view approved public posts at `/posts`
- **Team Management** — Team Leaders manage Content Makers with configurable team size limits
- **Protected Routes** — Secure routing with automatic redirect to login
- **Members Side Panel** — Slide-in panel organized by role sections
- **Responsive Design** — Works on mobile and desktop

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL) |
| Auth | Supabase Auth (with Google OAuth) |
| Database | Supabase (with RLS) |
| Routing | React Router v6 |
| Third Party API | RestCountries API |

---

## Project Structure

```
src/
├── App.jsx                        # Root — initializes auth and routing
├── supabaseClient.js              # Supabase client setup
├── routes/
│   ├── AppRoutes.jsx              # All route definitions
│   └── ProtectedRoute.jsx         # Auth guard for protected pages
├── components/
│   ├── CreateOrg.jsx              # Form to create an organization
│   ├── Invitations.jsx            # Pending invite notifications
│   ├── OrgPanel.jsx               # Side panel — members + invite (dashboard)
│   └── Toast.jsx                  # Toast notification component
├── hooks/
│   ├── useOrganizations.js        # Fetches user's organizations
│   └── useToast.js                # Controls toast notifications
└── pages/
    ├── Dashboard.jsx              # Main page after login
    ├── Login.jsx                  # Sign up / Log in page
    ├── OrgPage.jsx                # Org page with posts and members slide panel
    └── PostsFeed.jsx              # Public feed of approved posts
```

---

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/login` | Public | Login and signup page |
| `/posts` | Public | Public feed of approved posts |
| `/` | Protected | Dashboard — all your organizations |
| `/org/:slug` | Protected | Org page — posts, members, management |

---

## Roles & Permissions

| Permission | Viewer | Member | Content Maker | Team Leader | Admin | Owner |
|-----------|--------|--------|---------------|-------------|-------|-------|
| View public posts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View private posts | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Like posts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comment | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create posts | ❌ | ❌ | ✅ (pending) | ✅ (approved) | ✅ | ✅ |
| Approve posts | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Edit posts | ❌ | ❌ | Assigned only | All | All | All |
| Delete posts | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Invite members | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Remove members | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage roles | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Transfer ownership | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete organization | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | One profile per user — stores email |
| `organizations` | A company or team — has name, slug, country |
| `organization_members` | Bridge table — links users to orgs with role, manager_id, team_size_limit |
| `invitations` | Pending/accepted/declined invites |
| `posts` | Post content, title, status, org association |
| `likes` | User likes on posts |
| `comments` | User comments on posts |

### Enums

| Enum | Values |
|------|--------|
| `org_role` | `owner`, `admin`, `member`, `viewer`, `content_maker`, `team_leader` |
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
create type org_role as enum ('owner', 'admin', 'member', 'viewer', 'content_maker', 'team_leader');
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
  manager_id uuid references profiles(id) on delete set null,
  team_size_limit int default 5,
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

create table posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  created_by uuid references profiles(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  assigned_to uuid references profiles(id) on delete set null,
  status text default 'pending',
  is_public boolean default false,
  image_url text,
  created_at timestamptz default now()
);

create table likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
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

create policy "Owner can delete organization"
on organizations for delete
using (
  exists (
    select 1 from organization_members
    where org_id = organizations.id
    and user_id = auth.uid()
    and role = 'owner'
  )
);

-- Organization Members
alter table organization_members enable row level security;

create or replace function get_my_org_ids()
returns setof uuid
language sql
security definer
as $$
  select org_id from organization_members where user_id = auth.uid()
$$;

create or replace function is_org_admin(org_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from organization_members
    where organization_members.org_id = $1
    and organization_members.user_id = auth.uid()
    and organization_members.role in ('owner', 'admin')
  )
$$;

create policy "Members can view all members in their org"
on organization_members for select
using (org_id in (select get_my_org_ids()));

create policy "Users can join org via valid invite"
on organization_members for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from invitations
    where invitations.org_id = organization_members.org_id
    and invitations.invited_user_id = auth.uid()
    and invitations.status = 'pending'
  )
);

create policy "Owners and admins can insert members"
on organization_members for insert
with check (is_org_admin(organization_members.org_id));

create policy "Owners and admins can update roles"
on organization_members for update
using (is_org_admin(org_id));

create policy "Members can leave an organization"
on organization_members for delete
using (user_id = auth.uid() and role != 'owner');

create policy "Admins and owners can remove members"
on organization_members for delete
using (
  is_org_admin(org_id)
  and user_id != auth.uid()
);

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

-- Posts
alter table posts enable row level security;

create policy "Public can view posts"
on posts for select
using (status = 'approved' and is_public = true);

create policy "Members can view posts in their org"
on posts for select
using (
  exists (
    select 1 from organization_members
    where org_id = posts.org_id
    and user_id = auth.uid()
  )
);

create policy "Members can create posts based on role"
on posts for insert
with check (
  auth.uid() = created_by
  and exists (
    select 1 from organization_members
    where org_id = posts.org_id
    and user_id = auth.uid()
    and role in ('content_maker', 'team_leader', 'admin', 'owner')
  )
);

create policy "Members can edit posts based on role"
on posts for update
using (
  exists (
    select 1 from organization_members
    where org_id = posts.org_id
    and user_id = auth.uid()
    and (
      role in ('team_leader', 'admin', 'owner')
      or (role = 'content_maker' and posts.assigned_to = auth.uid())
    )
  )
);

create policy "Admins and owners can delete posts"
on posts for delete
using (
  exists (
    select 1 from organization_members
    where org_id = posts.org_id
    and user_id = auth.uid()
    and role in ('admin', 'owner')
  )
);

-- Likes
alter table likes enable row level security;

create policy "Anyone can view likes"
on likes for select using (true);

create policy "Authenticated users can like public posts"
on likes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can unlike their own likes"
on likes for delete
using (auth.uid() = user_id);

-- Comments
alter table comments enable row level security;

create policy "Members can view comments"
on comments for select using (true);

create policy "Members can comment on posts"
on comments for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from posts
    join organization_members on organization_members.org_id = posts.org_id
    where posts.id = comments.post_id
    and organization_members.user_id = auth.uid()
  )
);

create policy "Users can delete their own comments"
on comments for delete
using (auth.uid() = user_id);

create policy "Admins can delete any comment"
on comments for delete
using (
  exists (
    select 1 from posts
    join organization_members on organization_members.org_id = posts.org_id
    where posts.id = comments.post_id
    and organization_members.user_id = auth.uid()
    and organization_members.role in ('admin', 'owner')
  )
);
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
1. Owner or admin enters email in the members panel
2. App looks up the user in `profiles`
3. A `pending` invite is created in `invitations`
4. Invited user sees the invite on their dashboard
5. User accepts or declines

### Post Workflow
1. Content makers create posts — status starts as `pending`
2. Team leaders, admins, and owners can approve posts
3. Approved posts with `is_public = true` appear on the public feed at `/posts`
4. Team leaders and above can assign posts to content makers for editing

### Team Management
1. Admin or owner assigns a member the `team_leader` role
2. Team leader gets a default limit of 5 content makers
3. Admin or owner can change the limit per team leader
4. When a team leader is demoted or removed, their content makers are automatically moved to `member`

### Ownership Transfer
1. Owner can transfer ownership to any admin in the org
2. Previous owner becomes an admin
3. New owner gets full control

### Organization Deletion
1. Owner deletes the org
2. All members, invitations, posts, likes, and comments are cascade deleted

---

## Third Party API

This project uses the [RestCountries API](https://restcountries.com) to populate the country dropdown when creating an organization. No API key required.

---

## License

MIT