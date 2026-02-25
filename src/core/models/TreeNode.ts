import type { DocumentMeta } from './Document';

export interface TreeNode {
  meta: DocumentMeta;
  children: TreeNode[];
}
