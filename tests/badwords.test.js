const badwords = require('../src/main')

// test if empty string passed
test('empty string passed', () => {
    expect(() => badwords.badwords('')).toThrow('empty string passed')
})

// test with other than string
test('expect string', () => {
    expect(() => badwords.badwords({})).toThrow('string expected')
})
 

// test with no badwords
test('text is clean, should return empty array', () => {
    expect(badwords.badwords('lorem ipsum')).toMatchObject([])
})

// test with badwords
test('text is clean, should return empty array', () => {
    expect(badwords.badwords('lorem anjing')).toMatchObject(['anjing'])
})


// test with multiple badwords
test('text is clean, should return empty array', () => {
    expect(badwords.badwords('lorem anjing babi')).toMatchObject(['anjing', 'babi'])
})