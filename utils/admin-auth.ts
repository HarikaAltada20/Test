import { createClient } from '@/utils/supabase/server';

export async function verifyAdminAccess() {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { 
        isAdmin: false, 
        error: 'Authentication required', 
        user: null 
      };
    }

    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('user_type, email')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return { 
        isAdmin: false, 
        error: 'User data not found', 
        user: null 
      };
    }

    const isAdmin = userData.user_type === 'admin';
    
    return {
      isAdmin,
      error: isAdmin ? null : 'Admin access required',
      user: isAdmin ? {
        id: user.id,
        email: userData.email,
        user_type: userData.user_type
      } : null
    };

  } catch (error) {
    console.error('Admin verification error:', error);
    return { 
      isAdmin: false, 
      error: 'Internal server error', 
      user: null 
    };
  }
}

export async function requireAdminAccess() {
  const result = await verifyAdminAccess();
  
  if (!result.isAdmin) {
    throw new Error(result.error || 'Admin access required');
  }
  
  return result.user;
} 