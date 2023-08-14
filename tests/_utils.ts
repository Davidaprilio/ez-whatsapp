import readline from 'readline'

// Read line interface
const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout 
})

export function question(text: string, defaultValue: string = '') {
    return new Promise<string>((resolve) => rl.question(text, (answer) => resolve(answer || defaultValue)))
}
