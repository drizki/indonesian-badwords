module.exports = { 
    dict: require('./dict.json'),
    flag(text) { 
        if (!text) throw new Error('empty string passed')  
        if (typeof text !== 'string') throw new Error('string expected')

        return this.dict.some(word => text.toLowerCase().includes(word))
    },
    badwords(text) {
        if (!text) throw new Error('empty string passed')  
        if (typeof text !== 'string') throw new Error('string expected') 

        return this.dict.filter(word => text.toLowerCase().includes(word))
    },
    filter(text) {
        if (!text) throw new Error('empty string passed')  
        if (typeof text !== 'string') throw new Error('string expected') 

        const regex = new RegExp(`\\b(${this.dict.join('|')})\\b`, 'gi')
        return text.replace(regex, '')
    },
    censor(text, replacement = '***') { 
        if (!text) throw new Error('empty string passed')  
        if (typeof text !== 'string') throw new Error('string expected')
 
        const regex = new RegExp(`\\b(${this.dict.join('|')})\\b`, 'gi')
        return text.replace(regex, replacement)
    },
    analyze(text) { 
        if (!text) throw new Error('empty string passed') 
        if (typeof text !== 'string') throw new Error('string expected')
         
        const badwords = this.dict.filter(word => text.toLowerCase().includes(word)) 
        const words = text.split(' ') 
        const count = badwords.length  
        const locations = badwords.map(word => {
            const index = text.toLowerCase().indexOf(word)
            return {
                word,
                index
            }
        }) 
        const censored = this.censor(text) 
         
        return {
            text,
            words: words.length,
            censored: censored,
            badwords,
            count, 
            locations
        }
    }
}