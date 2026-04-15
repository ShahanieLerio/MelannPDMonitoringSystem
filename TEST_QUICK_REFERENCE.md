# Testing Quick Reference

## 🚀 Commands

```bash
# Run all tests
npm test

# Run tests with coverage report
npm test -- --coverage

# Run tests in watch mode (auto-rerun on changes)
npm test -- --watch

# Run specific test file
npm test -- types.test.ts
npm test -- dataStore.test.ts
npm test -- constants.test.tsx

# Run tests matching a pattern
npm test -- --grep "UserRole"

# Run tests with verbose output
npm test -- --reporter=verbose

# Run tests and open coverage report
npm test -- --coverage && start coverage/index.html
```

## 📊 Current Status

| Category | Tests | Status |
|----------|-------|--------|
| **Types** | 56 | ✅ All Passing |
| **Constants** | 42 | ✅ All Passing |
| **DataStore** | 28 | ✅ All Passing |
| **Components** | 85 | 🔄 Needs Integration |
| **Total** | 171 | 86 Passing |

## 📁 Test Files

```
✅ types.test.ts                    (56 tests)
✅ constants.test.tsx                (42 tests)
✅ services/dataStore.test.ts        (28 tests)
🔄 components/ConfirmationModal.test.tsx
🔄 components/ErrorBoundary.test.tsx
🔄 components/Sidebar.test.tsx
🔄 components/LoginPage.test.tsx
🔄 components/Dashboard.test.tsx
🔄 components/Collectors.test.tsx
🔄 components/UserManagement.test.tsx
🔄 components/HistoryModal.test.tsx
🔄 components/RemarksModal.test.tsx
```

## 🎯 Coverage Goals

- **Lines**: 90%
- **Functions**: 90%
- **Branches**: 90%
- **Statements**: 90%

## 📖 Documentation

- **TESTING.md** - Testing guide and examples
- **TEST_COVERAGE_SUMMARY.md** - Detailed coverage documentation
- **UNIT_TEST_IMPLEMENTATION.md** - Implementation summary

## 🔧 Common Tasks

### Add a New Test
1. Create `ComponentName.test.tsx` next to component
2. Import testing utilities:
   ```typescript
   import { describe, it, expect, vi } from 'vitest';
   import { render, screen } from '@testing-library/react';
   ```
3. Write tests following existing patterns
4. Run `npm test` to verify

### Debug Failing Test
1. Run specific test: `npm test -- ComponentName.test.tsx`
2. Check error message and stack trace
3. Verify mocks are properly configured
4. Ensure props match component expectations

### View Coverage Report
1. Run: `npm test -- --coverage`
2. Open: `coverage/index.html` in browser
3. Click on files to see line-by-line coverage
4. Focus on red (uncovered) lines

## 💡 Tips

- **Use `describe` blocks** to group related tests
- **Use `beforeEach`** to reset state between tests
- **Mock external dependencies** (fetch, localStorage, etc.)
- **Test user interactions** with `fireEvent` or `userEvent`
- **Use `waitFor`** for async assertions
- **Keep tests focused** - one concept per test

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests won't run | Check `npm install` completed successfully |
| Mock not working | Verify mock is defined before imports |
| Async test failing | Use `await waitFor()` for async operations |
| Coverage too low | Check coverage report for uncovered lines |
| Component not rendering | Verify all required props are provided |

## 📚 Resources

- [Vitest](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest DOM](https://github.com/testing-library/jest-dom)

---

**Quick Start**: `npm test -- --coverage`
