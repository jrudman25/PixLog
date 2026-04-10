-- Fix: timeline_members SELECT policy causes infinite recursion
-- The old policy did a subquery on timeline_members to check if you're a member,
-- but that subquery itself needs to pass the same policy → infinite loop.

-- Drop the broken policy
DROP POLICY IF EXISTS "members_select_own_timelines" ON public.timeline_members;

-- Create a SECURITY DEFINER function that bypasses RLS to check membership
CREATE OR REPLACE FUNCTION public.is_timeline_member(check_timeline_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.timeline_members
    WHERE timeline_id = check_timeline_id
      AND user_id = check_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- New policy: you can see your own memberships, AND all memberships
-- for timelines you belong to (using the SECURITY DEFINER function)
CREATE POLICY "members_select" ON public.timeline_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_timeline_member(timeline_id, auth.uid())
  );
