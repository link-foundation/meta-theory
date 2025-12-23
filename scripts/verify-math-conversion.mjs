#!/usr/bin/env node

/**
 * Math/Formula Conversion Verification Script
 *
 * This script verifies that mathematical formulas and code blocks in the markdown
 * article are correctly formatted for GitHub rendering.
 *
 * Checks:
 * 1. No LaTeX syntax inside code blocks (should use Unicode)
 * 2. No citation links inside $$...$$ formula blocks
 * 3. Formulas use proper GitHub-supported LaTeX syntax
 * 4. Code block content doesn't contain unintended LaTeX delimiters
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MARKDOWN_PATH = join(__dirname, '../archive/0.0.2/article.md');

/**
 * Extract code blocks from markdown
 * Returns array of { content, startLine, language }
 */
function extractCodeBlocks(markdown) {
  const codeBlocks = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  let currentBlock = null;
  let blockContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // Start of code block
        inCodeBlock = true;
        const language = line.slice(3).trim();
        currentBlock = { startLine: i + 1, language, content: '' };
        blockContent = [];
      } else {
        // End of code block
        currentBlock.content = blockContent.join('\n');
        currentBlock.endLine = i + 1;
        codeBlocks.push(currentBlock);
        inCodeBlock = false;
        currentBlock = null;
        blockContent = [];
      }
    } else if (inCodeBlock) {
      blockContent.push(line);
    }
  }

  return codeBlocks;
}

/**
 * Extract formula blocks from markdown ($$...$$)
 * Returns array of { content, startLine, endLine }
 */
function extractFormulaBlocks(markdown) {
  const formulas = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for inline formulas on same line: $$...$$
    const inlineMatches = line.match(/\$\$[^$]+\$\$/g);
    if (inlineMatches) {
      for (const match of inlineMatches) {
        formulas.push({
          content: match,
          line: i + 1,
          type: 'inline'
        });
      }
    }

    // Check for single-line inline math: $...$
    const singleDollarMatches = line.match(/(?<!\$)\$(?!\$)[^$]+\$(?!\$)/g);
    if (singleDollarMatches) {
      for (const match of singleDollarMatches) {
        formulas.push({
          content: match,
          line: i + 1,
          type: 'inline-single'
        });
      }
    }
  }

  return formulas;
}

/**
 * Check for LaTeX syntax that should not be in code blocks
 */
function checkCodeBlocksForLatex(codeBlocks) {
  const issues = [];

  // LaTeX patterns that should not appear in code blocks (should be Unicode)
  const latexPatterns = [
    { pattern: /\$\$[^$]+\$\$/g, description: 'LaTeX block delimiter $$...$$' },
    { pattern: /(?<!\$)\$(?!\$)[^$]+\$(?!\$)/g, description: 'LaTeX inline delimiter $...$' },
    { pattern: /\\times(?![a-zA-Z])/g, description: '\\times (should be ×)' },
    { pattern: /\\to(?![a-zA-Z])/g, description: '\\to (should be →)' },
    { pattern: /\\subseteq(?![a-zA-Z])/g, description: '\\subseteq (should be ⊆)' },
    { pattern: /\\in(?![a-zA-Z])/g, description: '\\in (should be ∈)' },
    { pattern: /\\emptyset(?![a-zA-Z])/g, description: '\\emptyset (should be ∅)' },
    { pattern: /\\mathbb\{[A-Z]\}/g, description: '\\mathbb{} (should be Unicode like ℕ)' },
  ];

  for (const block of codeBlocks) {
    // Skip Coq code blocks - they may legitimately contain some mathematical comments
    // But still check for obvious LaTeX delimiters
    const isCoq = block.language === 'coq';

    for (const { pattern, description } of latexPatterns) {
      const matches = block.content.match(pattern);
      if (matches) {
        // For Coq blocks, only flag $$ delimiters as errors
        if (isCoq && !description.includes('$$')) {
          continue;
        }

        for (const match of matches) {
          issues.push({
            type: 'latex_in_code',
            line: block.startLine,
            language: block.language,
            found: match,
            description: `Found ${description} in code block`,
            severity: 'error'
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check for citation links inside formula blocks
 */
function checkFormulasForCitations(formulas, markdown) {
  const issues = [];

  // Pattern for markdown links inside formulas
  const citationPattern = /\[\[[^\]]+\]\]\([^)]+\)/g;
  const linkPattern = /\[[^\]]+\]\([^)]+\)/g;

  for (const formula of formulas) {
    // Check for citation links inside the formula
    const citationMatches = formula.content.match(citationPattern);
    const linkMatches = formula.content.match(linkPattern);

    if (citationMatches) {
      for (const match of citationMatches) {
        issues.push({
          type: 'citation_in_formula',
          line: formula.line,
          found: match,
          description: 'Citation link found inside formula - should be outside $$...$$',
          severity: 'error'
        });
      }
    }

    if (linkMatches) {
      for (const match of linkMatches) {
        issues.push({
          type: 'link_in_formula',
          line: formula.line,
          found: match,
          description: 'Markdown link found inside formula - should be outside $$...$$',
          severity: 'warning'
        });
      }
    }
  }

  return issues;
}

/**
 * Check for common formula formatting issues
 */
function checkFormulaFormatting(markdown) {
  const issues = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for $$Set of... pattern (should be **Set of...**)
    if (/\$\$Set of/i.test(line)) {
      issues.push({
        type: 'text_in_formula',
        line: i + 1,
        found: line.substring(0, 80),
        description: 'Text description found inside $$ formula - should use markdown formatting',
        severity: 'error'
      });
    }

    // Check for unclosed formula blocks
    const dollarCount = (line.match(/\$\$/g) || []).length;
    if (dollarCount === 1) {
      // Single $$ on a line might be a block formula start/end - that's OK
      // But let's warn if it contains other content
      const beforeDollar = line.split('$$')[0];
      const afterDollar = line.split('$$')[1];
      if (beforeDollar.trim().length > 0 && afterDollar && afterDollar.trim().length > 0) {
        // Check if this is actually an inline formula with text before/after
        if (!/\$\$[^$]+\$\$/.test(line)) {
          issues.push({
            type: 'unclosed_formula',
            line: i + 1,
            found: line.substring(0, 80),
            description: 'Potentially unclosed formula block',
            severity: 'warning'
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check that code blocks with mathematical content use Unicode, not LaTeX
 */
function checkMathInCodeBlocks(codeBlocks) {
  const issues = [];

  // These are the expected Unicode characters that SHOULD be in code blocks
  const expectedUnicodePatterns = [
    { pattern: /×/g, description: 'multiplication sign ×' },
    { pattern: /→/g, description: 'arrow →' },
    { pattern: /⊆/g, description: 'subset ⊆' },
    { pattern: /∈/g, description: 'element of ∈' },
    { pattern: /ℕ/g, description: 'natural numbers ℕ' },
    { pattern: /²/g, description: 'superscript ²' },
    { pattern: /ⁿ/g, description: 'superscript ⁿ' },
  ];

  for (const block of codeBlocks) {
    // Skip Coq blocks for this check
    if (block.language === 'coq') continue;

    // For non-Coq blocks that should contain mathematical notation,
    // check if they're using Unicode properly
    const hasCartesianProduct = block.content.includes('L') &&
                                (block.content.includes('×') || block.content.includes('x'));

    if (hasCartesianProduct) {
      // This block likely contains mathematical set notation
      // Verify it uses × not \times or x for multiplication
      if (block.content.includes('\\times')) {
        issues.push({
          type: 'wrong_symbol',
          line: block.startLine,
          found: '\\times',
          expected: '×',
          description: 'Use Unicode × instead of \\times in code blocks',
          severity: 'error'
        });
      }
    }
  }

  return issues;
}

/**
 * Verify that all figures are referenced correctly
 */
function checkFigureReferences(markdown) {
  const issues = [];
  const figurePattern = /!\[Figure (\d+)\]\(images\/figure-(\d+)\.(png|jpg)\)/g;
  const expectedFigures = 13;
  const foundFigures = new Set();

  let match;
  while ((match = figurePattern.exec(markdown)) !== null) {
    const captionNum = parseInt(match[1]);
    const fileNum = parseInt(match[2]);

    if (captionNum !== fileNum) {
      issues.push({
        type: 'figure_mismatch',
        found: match[0],
        description: `Figure caption number (${captionNum}) doesn't match file number (${fileNum})`,
        severity: 'error'
      });
    }

    foundFigures.add(fileNum);
  }

  // Check for missing figures
  for (let i = 1; i <= expectedFigures; i++) {
    if (!foundFigures.has(i)) {
      issues.push({
        type: 'missing_figure',
        found: `Figure ${i}`,
        description: `Figure ${i} reference is missing from the article`,
        severity: 'error'
      });
    }
  }

  return issues;
}

/**
 * Main verification function
 */
function verifyMathConversion() {
  console.log('='.repeat(80));
  console.log('MATH/FORMULA CONVERSION VERIFICATION');
  console.log('='.repeat(80));
  console.log();

  // Read markdown file
  console.log('Reading markdown file:', MARKDOWN_PATH);
  const markdown = readFileSync(MARKDOWN_PATH, 'utf-8');
  console.log(`Loaded ${markdown.length} characters, ${markdown.split('\n').length} lines\n`);

  // Extract elements
  const codeBlocks = extractCodeBlocks(markdown);
  const formulas = extractFormulaBlocks(markdown);

  console.log(`Found ${codeBlocks.length} code blocks`);
  console.log(`Found ${formulas.length} formula expressions\n`);

  // Run all checks
  const allIssues = [];

  console.log('Checking code blocks for LaTeX syntax...');
  const latexIssues = checkCodeBlocksForLatex(codeBlocks);
  allIssues.push(...latexIssues);

  console.log('Checking formulas for citation links...');
  const citationIssues = checkFormulasForCitations(formulas, markdown);
  allIssues.push(...citationIssues);

  console.log('Checking formula formatting...');
  const formatIssues = checkFormulaFormatting(markdown);
  allIssues.push(...formatIssues);

  console.log('Checking mathematical symbols in code blocks...');
  const symbolIssues = checkMathInCodeBlocks(codeBlocks);
  allIssues.push(...symbolIssues);

  console.log('Checking figure references...');
  const figureIssues = checkFigureReferences(markdown);
  allIssues.push(...figureIssues);

  // Report results
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICATION RESULTS');
  console.log('='.repeat(80));

  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n All math/formula conversion checks passed!\n');
    return true;
  }

  if (errors.length > 0) {
    console.log(`\n ERRORS (${errors.length}):\n`);
    for (const issue of errors) {
      console.log(`  Line ${issue.line || 'N/A'}: ${issue.description}`);
      console.log(`    Found: "${issue.found}"`);
      if (issue.expected) {
        console.log(`    Expected: "${issue.expected}"`);
      }
      console.log();
    }
  }

  if (warnings.length > 0) {
    console.log(`\n WARNINGS (${warnings.length}):\n`);
    for (const issue of warnings) {
      console.log(`  Line ${issue.line || 'N/A'}: ${issue.description}`);
      console.log(`    Found: "${issue.found}"`);
      console.log();
    }
  }

  console.log('='.repeat(80));
  console.log(`Total: ${errors.length} errors, ${warnings.length} warnings`);
  console.log('='.repeat(80));

  // Return false only if there are errors
  return errors.length === 0;
}

// Run verification
const success = verifyMathConversion();
process.exit(success ? 0 : 1);
