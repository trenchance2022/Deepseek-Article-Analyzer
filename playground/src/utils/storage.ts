/** 本地存储工具 */

export type PaperStatus = 'uploaded' | 'parsing' | 'downloading' | 'extracted' | 'analyzing' | 'done' | 'error';

export interface PaperInfo {
  oss_key: string;
  oss_url: string;
  filename: string;
  size?: number;
  task_id?: string;
  status: PaperStatus;
  markdown_content?: string;
  error?: string;
  uploaded_at?: string;
  extracted_at?: string;
}

const STORAGE_KEY = 'papers_storage';

/**
 * 保存论文信息到本地存储
 */
export const savePapers = (papers: PaperInfo[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
  } catch (error) {
    console.error('保存论文信息失败:', error);
  }
};

/**
 * 从本地存储加载论文信息
 */
export const loadPapers = (): PaperInfo[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载论文信息失败:', error);
  }
  return [];
};

/**
 * 添加论文信息
 */
export const addPapers = (papers: PaperInfo[]): void => {
  const existing = loadPapers();
  const papersMap = new Map<string, PaperInfo>();
  
  // 先添加现有的
  existing.forEach(paper => {
    papersMap.set(paper.oss_key, paper);
  });
  
  // 添加新的（如果不存在）
  papers.forEach(paper => {
    if (!papersMap.has(paper.oss_key)) {
      papersMap.set(paper.oss_key, paper);
    }
  });
  
  savePapers(Array.from(papersMap.values()));
};

/**
 * 更新论文信息
 */
export const updatePaper = (ossKey: string, updates: Partial<PaperInfo>): void => {
  const papers = loadPapers();
  const index = papers.findIndex(p => p.oss_key === ossKey);
  
  if (index !== -1) {
    papers[index] = { ...papers[index], ...updates };
    savePapers(papers);
  }
};

/**
 * 删除论文信息
 */
export const deletePaper = (ossKey: string): void => {
  const papers = loadPapers();
  const filtered = papers.filter(p => p.oss_key !== ossKey);
  savePapers(filtered);
};

/**
 * 根据 oss_key 获取论文信息
 */
export const getPaperByOssKey = (ossKey: string): PaperInfo | undefined => {
  const papers = loadPapers();
  return papers.find(p => p.oss_key === ossKey);
};

/**
 * 根据状态筛选论文
 */
export const getPapersByStatus = (status: PaperStatus): PaperInfo[] => {
  const papers = loadPapers();
  return papers.filter(p => p.status === status);
};

/**
 * 获取所有论文（按上传时间倒序）
 */
export const getAllPapers = (): PaperInfo[] => {
  const papers = loadPapers();
  return papers.sort((a, b) => {
    const timeA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
    const timeB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
    return timeB - timeA;
  });
};

