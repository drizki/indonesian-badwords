const badwords = require('../src/main')

// test if empty string passed
test('empty string passed', () => {
    expect(() => badwords.censor('')).toThrow('empty string passed')
})

// test with other than string
test('expect string', () => {
    expect(() => badwords.censor({})).toThrow('string expected')
})

// test with no badwords
test('text is clean, should return false', () => {
    expect(badwords.censor('lorem ipsum')).toMatch('lorem ipsum')
})

// test with badwords
test('text has badwords', () => {
    expect(badwords.censor('lorem monyet')).toMatch('lorem ***')
})

// test with multiple badwords
test('text has multiple badwords', () => {
    expect(badwords.censor('lorem anjing babi!')).toMatch('lorem *** ***!')
})