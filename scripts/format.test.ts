import { expect, test } from 'bun:test';
import prettier from 'prettier';

test('Astro formatter sorts Tailwind utilities', async () => {
  const filepath = 'src/components/Project.astro';
  const config = await prettier.resolveConfig(filepath);
  const result = await prettier.format(
    '<div class="text-white p-4 flex">Hi</div>',
    { ...config, filepath },
  );
  expect(result).toContain('class="flex p-4 text-white"');
});
