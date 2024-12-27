const fs = require('fs-extra');
const path = require('path');

// 保留的备份数量
const MAX_BACKUPS = 5;

// 清理旧的备份
const cleanupBackups = async (backupDir) => {
    const backups = await fs.readdir(backupDir);
    if (backups.length <= MAX_BACKUPS) {
        return;
    }
    
    // 按时间戳从新到旧排序
    const sortedBackups = backups.sort((a, b) => {
        const timeA = a.split('-').map(n => n.padStart(2, '0')).join('');
        const timeB = b.split('-').map(n => n.padStart(2, '0')).join('');
        return timeB.localeCompare(timeA);
    });
    
    // 删除旧的备份
    const toDelete = sortedBackups.slice(MAX_BACKUPS);
    for (const backup of toDelete) {
        await fs.remove(path.join(backupDir, backup));
    }
};

const execute = async (flags = {}) => {
    const backupDir = path.join(process.cwd(), '.trnow-backup');
    
    try {
        // 检查备份目录是否存在
        if (!(await fs.pathExists(backupDir))) {
            return {
                type: 'error',
                text: '没有找到备份目录'
            };
        }

        // 获取所有备份
        const backups = await fs.readdir(backupDir);
        if (backups.length === 0) {
            return {
                type: 'error',
                text: '没有可用的备份'
            };
        }

        // 按时间戳从新到旧排序，获取最新的备份
        const sortedBackups = backups.sort((a, b) => {
            const timeA = a.split('-').map(n => n.padStart(2, '0')).join('');
            const timeB = b.split('-').map(n => n.padStart(2, '0')).join('');
            return timeB.localeCompare(timeA);
        });
        const latestBackup = sortedBackups[0];
        const latestBackupPath = path.join(backupDir, latestBackup);

        // 获取所有备份的文件
        const files = await getAllFiles(latestBackupPath);
        
        // 恢复文件
        let restoredCount = 0;
        for (const file of files) {
            const relativePath = path.relative(latestBackupPath, file);
            const targetPath = path.join(process.cwd(), relativePath);
            
            // 确保目标目录存在
            await fs.ensureDir(path.dirname(targetPath));
            
            // 复制文件
            await fs.copy(file, targetPath, { overwrite: true });
            restoredCount++;
        }

        // 清理旧的备份
        await cleanupBackups(backupDir);

        // 格式化显示时间
        const displayTime = latestBackup.replace(/-/g, ' ');

        return {
            type: 'success',
            text: `已恢复到 ${displayTime} 的版本，共恢复 ${restoredCount} 个文件，并清理了旧的备份`
        };
    } catch (error) {
        return {
            type: 'error',
            text: `恢复失败: ${error.message}`
        };
    }
};

// 递归获取目录下的所有文件
const getAllFiles = async (dir) => {
    const files = [];
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files.push(...(await getAllFiles(fullPath)));
        } else {
            files.push(fullPath);
        }
    }
    
    return files;
};

module.exports = {
    execute
}; 