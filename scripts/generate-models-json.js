
import fs from 'fs';
import path from 'path';

const modelsDir = path.join(process.cwd(), 'public', 'models');
const outputFile = path.join(process.cwd(), 'public', 'models.json');

try {
    const files = fs.readdirSync(modelsDir);
    const validModels = files.filter(file => {
        if (!file.endsWith('.obj')) return false;
        const filePath = path.join(modelsDir, file);
        const stats = fs.statSync(filePath);
        return stats.size > 100;
    }).map(file => `/models/${file}`);

    fs.writeFileSync(outputFile, JSON.stringify(validModels, null, 2));
    console.log(`Generated ${validModels.length} valid models in ${outputFile}`);
} catch (err) {
    console.error('Error generating models.json:', err);
}
