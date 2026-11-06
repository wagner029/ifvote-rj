import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export const SUPER_ADMIN_EMAIL = 'wagnerrocha029@gmail.com';

export interface AdminUser {
  uid: string;
  email: string;
  nome: string;
  papel: 'SUPER_ADMIN' | 'COMISSAO_ELEITORAL' | 'MESARIO' | 'AUDITOR';
  pleitoDesignado?: string; // ID do pleito para o qual a comissão tem acesso
  cadastradoEm: string;
}

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  papel: 'SUPER_ADMIN' | 'COMISSAO_ELEITORAL' | 'MESARIO' | 'AUDITOR' | null;
  pleitoDesignado?: string | null;
  carregando: boolean;
  erroAuth: string | null;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Realiza login administrativo com provedor Google OAuth
 */
export async function loginComGoogle(): Promise<{ ok: boolean; user?: User; erro?: string }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Verifica autorização
    const autorizacao = await verificarSeAdmin(user.email, user.uid);
    if (!autorizacao.isAdmin) {
      // Se não for admin autorizado, desloga imediatamente
      await signOut(auth);
      return {
        ok: false,
        erro: `Acesso Negado: A conta Google (${user.email}) não está na lista de administradores autorizados da comissão eleitoral.`,
      };
    }

    return { ok: true, user };
  } catch (err: any) {
    console.error('Erro no login com Google:', err);
    let msg = 'Falha na autenticação com Google.';
    if (err.code === 'auth/popup-closed-by-user') {
      msg = 'O popup de autenticação foi fechado antes da conclusão.';
    } else if (err.code === 'auth/popup-blocked') {
      msg = 'O popup foi bloqueado pelo navegador. Permita popups para este site.';
    } else if (err.message) {
      msg = err.message;
    }
    return { ok: false, erro: msg };
  }
}

/**
 * Realiza logout da conta administrativa
 */
export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Verifica se um email ou UID possui permissões administrativas
 */
export async function verificarSeAdmin(
  email: string | null,
  uid?: string
): Promise<{ isAdmin: boolean; papel: AdminUser['papel'] | null; pleitoDesignado?: string | null }> {
  if (!email) return { isAdmin: false, papel: null };

  const cleanEmail = email.toLowerCase().trim();

  // 1. Super Admin primário do sistema (acesso total a todos os pleitos e Controle Geral)
  if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { isAdmin: true, papel: 'SUPER_ADMIN', pleitoDesignado: null };
  }

  try {
    // 2. Busca na coleção admins por email
    const adminDoc = await getDoc(doc(db, 'admins', cleanEmail));
    if (adminDoc.exists()) {
      const data = adminDoc.data() as AdminUser;
      return { isAdmin: true, papel: data.papel || 'COMISSAO_ELEITORAL', pleitoDesignado: data.pleitoDesignado || null };
    }

    // 3. Busca por UID se fornecido
    if (uid) {
      const adminUidDoc = await getDoc(doc(db, 'admins', uid));
      if (adminUidDoc.exists()) {
        const data = adminUidDoc.data() as AdminUser;
        return { isAdmin: true, papel: data.papel || 'COMISSAO_ELEITORAL', pleitoDesignado: data.pleitoDesignado || null };
      }
    }
  } catch (error) {
    console.warn('Erro ao verificar permissões de admin no Firestore:', error);
  }

  return { isAdmin: false, papel: null };
}

/**
 * Lista todos os administradores cadastrados (acessível pelo Super Admin)
 */
export async function listarAdministradores(): Promise<AdminUser[]> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    const lista: AdminUser[] = [];

    // Inclui Super Admin padrão
    lista.push({
      uid: 'super-admin',
      email: SUPER_ADMIN_EMAIL,
      nome: 'Wagner Rocha (Admin Master)',
      papel: 'SUPER_ADMIN',
      cadastradoEm: new Date().toISOString(),
    });

    for (const d of snap.docs) {
      const admin = d.data() as AdminUser;
      if (admin.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        lista.push({ ...admin, email: d.id });
      }
    }

    return lista;
  } catch (err) {
    console.error('Erro ao listar administradores:', err);
    return [
      {
        uid: 'super-admin',
        email: SUPER_ADMIN_EMAIL,
        nome: 'Wagner Rocha (Admin Master)',
        papel: 'SUPER_ADMIN',
        cadastradoEm: new Date().toISOString(),
      },
    ];
  }
}

/**
 * Adiciona um novo administrador / membro da comissão autorizado (acessível por Super Admin)
 */
export async function autorizarAdministrador(
  email: string,
  nome: string,
  papel: 'COMISSAO_ELEITORAL' | 'MESARIO' | 'AUDITOR' = 'COMISSAO_ELEITORAL',
  pleitoDesignado?: string
): Promise<{ ok: boolean; erro?: string }> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, erro: 'Informe um email válido.' };
  }

  try {
    const adminRef = doc(db, 'admins', cleanEmail);
    await setDoc(adminRef, {
      email: cleanEmail,
      nome: nome.trim() || cleanEmail,
      papel,
      pleitoDesignado: pleitoDesignado?.trim() || 'ifvote-rj',
      cadastradoEm: new Date().toISOString(),
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err.message || 'Erro ao registrar administrador no Firestore.' };
  }
}

/**
 * Remove a autorização de um administrador
 */
export async function revogarAdministrador(email: string): Promise<{ ok: boolean; erro?: string }> {
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, erro: 'O Super Administrador principal não pode ser removido.' };
  }

  try {
    const adminRef = doc(db, 'admins', cleanEmail);
    await deleteDoc(adminRef);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err.message || 'Erro ao revogar administrador no Firestore.' };
  }
}

/**
 * Escuta as mudanças de estado de autenticação e valida permissões
 */
export function subscribeAuth(onUpdate: (state: AuthState) => void): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onUpdate({
        user: null,
        isAdmin: false,
        papel: null,
        pleitoDesignado: null,
        carregando: false,
        erroAuth: null,
      });
      return;
    }

    try {
      const { isAdmin, papel, pleitoDesignado } = await verificarSeAdmin(user.email, user.uid);
      onUpdate({
        user,
        isAdmin,
        papel,
        pleitoDesignado: pleitoDesignado || null,
        carregando: false,
        erroAuth: isAdmin
          ? null
          : `A conta Google (${user.email}) não está autorizada como membro da comissão eleitoral.`,
      });
    } catch {
      onUpdate({
        user,
        isAdmin: false,
        papel: null,
        pleitoDesignado: null,
        carregando: false,
        erroAuth: 'Erro ao validar privilégios administrativos.',
      });
    }
  });
}
