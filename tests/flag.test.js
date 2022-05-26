const badwords = require('../src/main')

// test if empty string passed
test('empty string passed', () => {
    expect(() => badwords.flag('')).toThrow('empty string passed')
})

// test with other than string
test('expect string', () => {
    expect(() => badwords.flag({})).toThrow('string expected')
})

// test with no badwords
test('text is clean, should return false', ()=> {
    expect(badwords.flag('lorem ipsum')).toBe(false)
})

// test with badwords
test('text has badwords, should return true', ()=> {
    expect(badwords.flag('lorem anjing!')).toBe(true)
})