// Global test setup
import { vi } from 'vitest'

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  //log: vi.fn(), //Remove this for robust logging
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}

// Setup fetch mock globally
global.fetch = vi.fn()
