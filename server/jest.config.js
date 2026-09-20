
export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  transform: {}, 
  setupFiles: ['./tests/jest.setup.js'],
  /** Uncomment the line below if Jest complains about a lingering handle */
  // after teardown: forceExit: true,
};