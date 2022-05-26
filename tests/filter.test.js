const badwords = require('../src/main')

// test if empty string passed
test('empty string passed', () => {
    expect(() => badwords.filter('')).toThrow('empty string passed')
})

// test with other than string
test('expect string', () => {
    expect(() => badwords.filter({})).toThrow('string expected')
})
 

// test with no badwords
test('text is clean, should return empty array', () => {
    expect(badwords.filter('lorem ipsum')).toMatch('lorem ipsum')
})

// test with badwords
test('text is clean, should return empty array', () => {
    expect(badwords.filter('lorem ipsum anjing')).toMatch('lorem ipsum')
})


// test with multiple badwords
test('text is clean, should return empty array', () => {
    expect(badwords.filter('lorem ipsum babi anjing')).toMatch('lorem ipsum')
})