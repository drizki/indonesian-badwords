const badwords = require('../src/main')

// test if empty string passed
test('empty string passed', () => {
    expect(() => badwords.analyze('')).toThrow('empty string passed')
})

// test with other than string
test('expect string', () => {
    expect(() => badwords.analyze({})).toThrow('string expected')
})

// test with no badwords 
test('text is clean, should return false', () => {
    expect(badwords.analyze('lorem ipsum')).toMatchObject({
        text: 'lorem ipsum',
        words: 2,
        censored: 'lorem ipsum',
        badwords: [],
        count: 0,
        locations: []
    })
})

// test with single badword
test('text has badwords, should return matched object', () => {
    expect(badwords.analyze('lorem anjing!')).toMatchObject({
        text: 'lorem anjing!',
        words: 2,
        censored: 'lorem ***!',
        badwords: ['anjing'],
        count: 1,
        locations: [{
            word: 'anjing',
            index: 6
        }]
    })
})


// test with multiple badwords
test('text has badwords, should return matched object', () => {
    expect(badwords.analyze('lorem anjing babi!')).toMatchObject({
        text: 'lorem anjing babi!',
        words: 3,
        censored: 'lorem *** ***!',
        badwords: ['anjing', 'babi'],
        count: 2,
        locations: [{
            word: 'anjing',
            index: 6
        },
        {
            word: 'babi',
            index: 13
        }]
    })
})