import { promises as fs } from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { BrowserCommandContext } from 'vitest/node';

// Export the type
export type CompareOptions = {
  /** Name of the test for organizing snapshots */
  testName: string;
  /** Directory for baseline images */
  baselineDir?: string;
  /** Directory for diff images */
  diffDir?: string;
  /** Matching threshold (0-1) */
  threshold?: number;
  /** Maximum allowed difference percentage */
  maxDiffPercentage?: number;
  /** Whether to update baseline images */
  updateBaseline?: boolean;
};

/**
 * Compare a screenshot with its baseline
 * @param context - Context
 * @param screenshotPath - Path to the screenshot
 * @param options - Comparison options
 */
export const compareScreenshot = async (
  context: BrowserCommandContext,
  screenshotPath: string,
  options: CompareOptions,
): Promise<{ matches: boolean; diffPercentage?: number; message: string }> => {
  const { testPath } = context;

  if (!testPath) {
    throw new Error('Could not determine test path from context.');
  }

  const testDir = testPath.replace(/\/[^/]*$/, '');
  const {
    testName,
    baselineDir = `${testDir}/__image_snapshots__`,
    diffDir = `${testDir}/__image_diffs__`,
    threshold = 0.1, // recommended default in pixelmatch docs
    maxDiffPercentage = 1.0,
    updateBaseline = process.env.UPDATE_SNAPSHOTS === 'true',
  } = options;

  const testBaselineDir = path.join(baselineDir, testName);
  const testDiffDir = path.join(diffDir, testName);

  const filename = path.basename(screenshotPath);
  const baselinePath = path.join(testBaselineDir, filename);
  const diffPath = path.join(testDiffDir, `diff-${filename}`);

  // Create directories if they don't exist
  await fs.mkdir(testBaselineDir, { recursive: true });
  await fs.mkdir(testDiffDir, { recursive: true });

  if (updateBaseline) {
    await fs.copyFile(screenshotPath, baselinePath);
    return {
      matches: true,
      message: `Updated baseline image: ${baselinePath}`,
    };
  }

  try {
    // Check if baseline exists
    await fs.access(baselinePath);

    const [img1Data, img2Data] = await Promise.all([fs.readFile(baselinePath), fs.readFile(screenshotPath)]);

    const img1 = PNG.sync.read(img1Data);
    const img2 = PNG.sync.read(img2Data);

    if (img1.width !== img2.width || img1.height !== img2.height) {
      return {
        matches: false,
        message: `Image dimensions don't match: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`,
      };
    }

    // Create empty diff image buffer (pixelmatch will mutate this buffer to store the diff)
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    // Compare images
    const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold });

    // Save diff image
    await fs.writeFile(diffPath, PNG.sync.write(diff));

    const diffPercentage = (numDiffPixels / (width * height)) * 100;
    const matches = diffPercentage <= maxDiffPercentage;

    return {
      matches,
      diffPercentage,
      message: matches
        ? `Image matches baseline (diff: ${diffPercentage.toFixed(2)}%)`
        : `Image differs from baseline by ${diffPercentage.toFixed(2)}% (threshold: ${maxDiffPercentage}%). See diff: ${diffPath}`,
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // Create baseline if it doesn't exist
      await fs.copyFile(screenshotPath, baselinePath);
      return {
        matches: true,
        message: `Created new baseline image: ${baselinePath}`,
      };
    }
    console.info({ error });
    throw error;
  }
};
