import { create } from 'zustand';

export type AgentStepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';
export type AgentJobStatus = 'planning' | 'awaiting-confirm' | 'running' | 'done' | 'error' | 'cancelled';

export interface AgentJobStep {
  id: string;
  label: string;
  status: AgentStepStatus;
  detail?: string;
}

export interface AgentJob {
  id: string;
  command: string;
  status: AgentJobStatus;
  steps: AgentJobStep[];
  createdAt: number;
  finishedAt?: number;
  summary?: string;
}

interface AgentJobsStore {
  jobs: AgentJob[];
  createJob: (command: string, steps: AgentJobStep[], status?: AgentJobStatus) => string;
  setJobStatus: (jobId: string, status: AgentJobStatus, summary?: string) => void;
  setStepStatus: (jobId: string, stepId: string, status: AgentStepStatus, detail?: string) => void;
  setSteps: (jobId: string, steps: AgentJobStep[]) => void;
  clearFinished: () => void;
}

function patchJob(jobs: AgentJob[], jobId: string, patch: (job: AgentJob) => AgentJob) {
  return jobs.map((job) => (job.id === jobId ? patch(job) : job));
}

export const useAgentJobsStore = create<AgentJobsStore>((set) => ({
  jobs: [],

  createJob: (command, steps, status = 'running') => {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    set((state) => ({
      jobs: [{ id, command, status, steps, createdAt: Date.now() }, ...state.jobs].slice(0, 20),
    }));
    return id;
  },

  setJobStatus: (jobId, status, summary) => set((state) => ({
    jobs: patchJob(state.jobs, jobId, (job) => ({
      ...job,
      status,
      summary: summary ?? job.summary,
      finishedAt: status === 'done' || status === 'error' || status === 'cancelled' ? Date.now() : job.finishedAt,
    })),
  })),

  setStepStatus: (jobId, stepId, status, detail) => set((state) => ({
    jobs: patchJob(state.jobs, jobId, (job) => ({
      ...job,
      steps: job.steps.map((step) => (step.id === stepId ? { ...step, status, detail: detail ?? step.detail } : step)),
    })),
  })),

  setSteps: (jobId, steps) => set((state) => ({
    jobs: patchJob(state.jobs, jobId, (job) => ({ ...job, steps })),
  })),

  clearFinished: () => set((state) => ({
    jobs: state.jobs.filter((job) => job.status === 'running' || job.status === 'planning' || job.status === 'awaiting-confirm'),
  })),
}));
