export type ElectionStatus = 'CONFIGURACAO' | 'ABERTA' | 'ENCERRADA';

export interface Election {
  id: string;
  title: string;
  officeTitle: string;
  institution: string;
  status: ElectionStatus;
  createdAt: string;
  openedAt?: string;
  closedAt?: string;
  allowedVotersCount: number;
  votedCount: number;
  zeresimaEmitted: boolean;
  zeresimaEmittedAt?: string;
  createdBy: string;
  boletimUrna?: BoletimUrnaData;
}

export interface Candidate {
  id: string;
  number: string;
  name: string;
  ballotName: string;
  chapa: string;
  viceName?: string;
  photoUrl: string;
}

export type VoterCategory = 'Discente' | 'Docente' | 'TAE';

export interface Voter {
  id: string;
  identifier: string; // CPF or Matrícula
  name: string;
  category: VoterCategory;
  hasVoted: boolean;
  votedAt?: string;
  authorizedBy?: string;
  createdAt?: string;
}

export type VoteType = 'CANDIDATE' | 'BRANCO' | 'NULO';

export interface Vote {
  id: string;
  type: VoteType;
  candidateNumber?: string;
  createdAt: string;
}

export type BoothStatus = 'WAITING_AUTHORIZATION' | 'VOTING' | 'FINISHED';

export interface BoothSession {
  id: string;
  status: BoothStatus;
  token?: string;
  voterCategory?: VoterCategory;
  authorizedAt?: string;
  expiresAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  performedBy: string;
  createdAt: string;
}

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'PRESIDENTE' | 'MESARIO' | 'FISCAL';
}

export interface CandidateResult {
  candidate: Candidate;
  votes: number;
  percentage: number;
}

export interface BoletimUrnaData {
  electionId: string;
  electionTitle: string;
  closedAt: string;
  totalAptVoters: number;
  totalVotersVoted: number;
  totalVotesCast: number;
  abstentions: number;
  validVotes: number;
  blankVotes: number;
  nullVotes: number;
  results: CandidateResult[];
  hashIntegridade: string;
  signedBy: string;
}
