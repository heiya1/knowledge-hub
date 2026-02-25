import type { IFileSystem } from '../core/interfaces/IFileSystem';
import type { IGitService } from '../core/interfaces/IGitService';
import { DocumentService } from '../core/services/DocumentService';
import { TreeService } from '../core/services/TreeService';

export interface Container {
  fs: IFileSystem;
  documentService: DocumentService;
  treeService: TreeService;
  gitService?: IGitService;
}

let container: Container | null = null;

export function initContainer(fs: IFileSystem, workspacePath: string): Container {
  const documentService = new DocumentService(fs, workspacePath);
  const treeService = new TreeService();
  container = { fs, documentService, treeService };
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
  if (container) {
    container.fs = fs;
    container.documentService = documentService;
    container.treeService = treeService;
  } else {
    container = { fs, documentService, treeService };
  }
}
