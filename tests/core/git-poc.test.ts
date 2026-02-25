import { describe, it, expect } from 'vitest';
import git from 'isomorphic-git';
import { Volume } from 'memfs';

/**
 * PoC: Verify isomorphic-git core operations work with an in-memory filesystem.
 *
 * In the real app, TauriFsAdapter bridges Tauri's plugin-fs to isomorphic-git's
 * expected fs interface. Here we use memfs (which provides the same Node.js fs
 * API shape) to validate that the git operations logic is sound.
 *
 * If these tests pass, the remaining risk is only the Tauri FS adapter layer,
 * which can be verified with a manual Tauri integration test.
 */
describe('isomorphic-git PoC', () => {
  it('can init, add, and commit', async () => {
    const vol = Volume.fromJSON({});
    const dir = '/repo';

    await git.init({ fs: vol as never, dir, defaultBranch: 'main' });

    // Create a file
    await vol.promises.mkdir(`${dir}/pages`, { recursive: true });
    await vol.promises.writeFile(
      `${dir}/pages/test.md`,
      '---\ntitle: "Test"\n---\nHello'
    );

    // Add and commit
    await git.add({ fs: vol as never, dir, filepath: 'pages/test.md' });
    const oid = await git.commit({
      fs: vol as never,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@test.com' },
    });

    expect(oid).toBeTruthy();
    expect(typeof oid).toBe('string');
    expect(oid.length).toBe(40); // SHA-1 hash

    // Verify log
    const log = await git.log({ fs: vol as never, dir, depth: 1 });
    expect(log).toHaveLength(1);
    // isomorphic-git preserves the trailing newline that git adds to messages
    expect(log[0].commit.message.trim()).toBe('Initial commit');
    expect(log[0].commit.author.name).toBe('Test');
  });

  it('can detect file status changes', async () => {
    const vol = Volume.fromJSON({});
    const dir = '/repo';

    await git.init({ fs: vol as never, dir, defaultBranch: 'main' });

    // Create and commit a file
    await vol.promises.mkdir(`${dir}/pages`, { recursive: true });
    await vol.promises.writeFile(`${dir}/pages/page1.md`, 'Content 1');
    await git.add({ fs: vol as never, dir, filepath: 'pages/page1.md' });
    await git.commit({
      fs: vol as never,
      dir,
      message: 'Add page1',
      author: { name: 'Test', email: 'test@test.com' },
    });

    // Modify the file
    await vol.promises.writeFile(`${dir}/pages/page1.md`, 'Modified content');

    // Check status
    const matrix = await git.statusMatrix({ fs: vol as never, dir });
    const modified = matrix.filter(
      ([, head, workdir]) => head === 1 && workdir === 2
    );
    expect(modified).toHaveLength(1);
    expect(modified[0][0]).toBe('pages/page1.md');
  });

  it('can handle multiple commits and log history', async () => {
    const vol = Volume.fromJSON({});
    const dir = '/repo';

    await git.init({ fs: vol as never, dir, defaultBranch: 'main' });
    await vol.promises.mkdir(`${dir}/pages`, { recursive: true });

    // First commit
    await vol.promises.writeFile(`${dir}/pages/page1.md`, 'Version 1');
    await git.add({ fs: vol as never, dir, filepath: 'pages/page1.md' });
    await git.commit({
      fs: vol as never,
      dir,
      message: 'First commit',
      author: { name: 'Alice', email: 'alice@test.com' },
    });

    // Second commit
    await vol.promises.writeFile(`${dir}/pages/page1.md`, 'Version 2');
    await git.add({ fs: vol as never, dir, filepath: 'pages/page1.md' });
    await git.commit({
      fs: vol as never,
      dir,
      message: 'Update page',
      author: { name: 'Bob', email: 'bob@test.com' },
    });

    // Check full log
    const log = await git.log({ fs: vol as never, dir });
    expect(log).toHaveLength(2);
    expect(log[0].commit.message.trim()).toBe('Update page');
    expect(log[0].commit.author.name).toBe('Bob');
    expect(log[1].commit.message.trim()).toBe('First commit');
    expect(log[1].commit.author.name).toBe('Alice');
  });

  it('can get file-specific log', async () => {
    const vol = Volume.fromJSON({});
    const dir = '/repo';

    await git.init({ fs: vol as never, dir, defaultBranch: 'main' });
    await vol.promises.mkdir(`${dir}/pages`, { recursive: true });

    // Commit page1
    await vol.promises.writeFile(`${dir}/pages/page1.md`, 'Page 1');
    await git.add({ fs: vol as never, dir, filepath: 'pages/page1.md' });
    await git.commit({
      fs: vol as never,
      dir,
      message: 'Add page1',
      author: { name: 'Test', email: 'test@test.com' },
    });

    // Commit page2
    await vol.promises.writeFile(`${dir}/pages/page2.md`, 'Page 2');
    await git.add({ fs: vol as never, dir, filepath: 'pages/page2.md' });
    await git.commit({
      fs: vol as never,
      dir,
      message: 'Add page2',
      author: { name: 'Test', email: 'test@test.com' },
    });

    // Get log for page1 only
    const page1Log = await git.log({
      fs: vol as never,
      dir,
      filepath: 'pages/page1.md',
    });
    expect(page1Log).toHaveLength(1);
    expect(page1Log[0].commit.message.trim()).toBe('Add page1');
  });

  it('can detect new (untracked) files via statusMatrix', async () => {
    const vol = Volume.fromJSON({});
    const dir = '/repo';

    await git.init({ fs: vol as never, dir, defaultBranch: 'main' });

    // Create initial commit (git needs at least one commit for statusMatrix)
    await vol.promises.mkdir(`${dir}/pages`, { recursive: true });
    await vol.promises.writeFile(`${dir}/pages/existing.md`, 'Existing');
    await git.add({ fs: vol as never, dir, filepath: 'pages/existing.md' });
    await git.commit({
      fs: vol as never,
      dir,
      message: 'Initial',
      author: { name: 'Test', email: 'test@test.com' },
    });

    // Add a new file without staging
    await vol.promises.writeFile(`${dir}/pages/new-page.md`, 'New content');

    const matrix = await git.statusMatrix({ fs: vol as never, dir });

    // Find the new file: HEAD=0 (absent), WORKDIR=2 (present)
    const newFiles = matrix.filter(
      ([, head, workdir]) => head === 0 && workdir === 2
    );
    expect(newFiles).toHaveLength(1);
    expect(newFiles[0][0]).toBe('pages/new-page.md');
  });

  it('can remove a file and detect deletion', async () => {
    const vol = Volume.fromJSON({});
    const dir = '/repo';

    await git.init({ fs: vol as never, dir, defaultBranch: 'main' });
    await vol.promises.mkdir(`${dir}/pages`, { recursive: true });

    // Create and commit
    await vol.promises.writeFile(`${dir}/pages/to-delete.md`, 'Will be deleted');
    await git.add({ fs: vol as never, dir, filepath: 'pages/to-delete.md' });
    await git.commit({
      fs: vol as never,
      dir,
      message: 'Add file',
      author: { name: 'Test', email: 'test@test.com' },
    });

    // Delete the file from the working directory
    await vol.promises.unlink(`${dir}/pages/to-delete.md`);

    const matrix = await git.statusMatrix({ fs: vol as never, dir });

    // Deleted file: HEAD=1 (was present), WORKDIR=0 (absent)
    const deleted = matrix.filter(
      ([, head, workdir]) => head === 1 && workdir === 0
    );
    expect(deleted).toHaveLength(1);
    expect(deleted[0][0]).toBe('pages/to-delete.md');
  });
});
