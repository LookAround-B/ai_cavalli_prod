-- Bills Table
create table if not exists public.bills (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade not null unique,
  bill_number text unique not null,
  items_total decimal(10,2) not null,
  discount_amount decimal(10,2) default 0,
  final_total decimal(10,2) not null,
  payment_method text, -- 'cash', 'upi', 'card'
  payment_status text default 'pending', -- 'pending', 'paid'
  printed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bill Items Table
create table if not exists public.bill_items (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid references public.bills(id) on delete cascade not null,
  item_name text not null,
  quantity integer not null,
  price decimal(10,2) not null,
  subtotal decimal(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add billed column to orders table
alter table public.orders add column if not exists billed boolean default false;

-- RLS Policies for Bills
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;

-- Staff can view all bills
create policy "Staff view all bills" on public.bills for select
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );

-- Staff can create bills
create policy "Staff create bills" on public.bills for insert
  with check (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );

-- Staff can update bills (for payment status)
create policy "Staff update bills" on public.bills for update
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );

-- Staff can view all bill items
create policy "Staff view all bill items" on public.bill_items for select
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );

-- Staff can create bill items
create policy "Staff create bill items" on public.bill_items for insert
  with check (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );

-- Sequence for continuous bill numbers
create sequence if not exists bill_number_seq start 1;

-- Function to generate sequential bill numbers (pure numeric, continuous)
create or replace function generate_bill_number()
returns text as $$
begin
  return nextval('bill_number_seq')::text;
end;
$$ language plpgsql;

-- Create indexes for performance
create index if not exists idx_bills_order_id on public.bills(order_id);
create index if not exists idx_bills_bill_number on public.bills(bill_number);
create index if not exists idx_bill_items_bill_id on public.bill_items(bill_id);
