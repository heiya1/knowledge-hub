import type { IFileSystem } from '../core/interfaces/IFileSystem';
import type { IGitService } from '../core/interfaces/IGitService';
import { DocumentService } from '../core/services/DocumentService';
import { TreeService } from '../core/services/TreeService';
import { SearchService } from '../core/services/SearchService';
import { IsomorphicGitService } from './IsomorphicGitService';

export interface Container {
  fs: IFileSystem;
  workspacePath: string;
  documentService: DocumentService;
  treeService: TreeService;
  searchService: SearchService;
  gitService: IGitService;
}

let container: Container | null = null;

export function initContainer(fs: IFileSystem, workspacePath: string): Container {
  const documentService = new DocumentService(fs, workspacePath);
  const treeService = new TreeService();
  const searchService = new SearchService();
  const gitService = new IsomorphicGitService();
  container = { fs, workspacePath, documentService, treeService, searchService, gitService };
  return container;
}

export function getContainer(): Container {
  if (!container) {
    throw new Error('Container not initialized. Call initContainer first.');
  }
  return container;
}

export function updateWorkspacePath(fs: IFileSystem, workspacePath: string): void {
  const documentService = new DocumentService(fs, workspacePath);
  const treeService = new TreeService();
  const searchService = new SearchService();
  const gitService = new IsomorphicGitService();
  if (container) {
    container.fs = fs;
    container.workspacePath = workspacePath;
    container.documentService = documentService;
    container.treeService = treeService;
    container.searchService = searchService;
    container.gitService = gitService;
  } else {
    container = { fs, workspacePath, documentService, treeService, searchService, gitService };
  }
}
