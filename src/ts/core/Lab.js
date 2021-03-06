"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const Dir_1 = require("../util/io/Dir");
const utils_1 = require("../util/misc/utils");
const LabInstructions_1 = require("./LabInstructions");
const runCommand_1 = require("./runCommand");
var LabFile;
(function (LabFile) {
    LabFile["GIT"] = ".git";
    LabFile["GITIGNORE"] = ".gitignore";
    LabFile["README"] = "README.txt";
    LabFile["CMAKE_LISTS"] = "CMakeLists.txt";
    LabFile["MAKEFILE"] = "Makefile";
    LabFile["IDEA"] = ".idea";
    LabFile["CMAKE_BUILD_DEBUG"] = "cmake-build-debug";
    LabFile["OBJECT_FILES"] = "*.o";
    LabFile["EXE_FILES"] = "*.exe";
    LabFile["SUBMISSION"] = "*.mbox";
})(LabFile || (LabFile = {}));
function filesCreator(files) {
    return () => Object.values(files).asyncForEach(file => file.create());
}
exports.Lab = {
    new(options) {
        const { number, partNumbers, instructionsPath, parentDir: parentDirPath = "/mnt/c/Users/Khyber/workspace/AdvancedProgramming", remote: { username: remoteUsername = "ks3343", url: remoteUrl = "clac.cs.columbia.edu", parentDir: remoteParentDir = "~/cs3157", } = {}, } = options;
        const name = `lab${number}`;
        const labName = name;
        const parentDir = Dir_1.Dir.of(parentDirPath);
        const dir = parentDir.dir(name);
        const labDir = dir;
        const instructionsFileName = `Lab ${number} Instructions.txt`;
        const remoteName = `${remoteUsername}@${remoteUrl}`;
        const remoteDir = `${remoteParentDir}/${name}`;
        const remote = `${remoteName}:${remoteDir}`;
        const syncCommand = (local) => (toRemote) => `rsync -az ${toRemote ? local : remote} ${toRemote ? remote : `../${local}`}`;
        const cMakeListsTxt = (name) => [
            "cmake_minimum_required(VERSION 3.9)",
            "set(CMAKE_C_STANDARD 11)",
            `project(${name} C)`,
            "",
            "set(SOURCE_FILES\n)",
            "",
            `add_executable(${name} \${SOURCE_FILES})`,
        ].join("\n");
        const parts = partNumbers
            .map(number => {
            const name = `part${number}`;
            const fullName = `${labName}_${name}`;
            const dir = labDir.dir(name);
            return {
                number,
                name,
                fullName,
                dir,
                files: {
                    cMakeListsTxt: dir.fileToCreate(LabFile.CMAKE_LISTS, cMakeListsTxt(fullName)),
                    makeFile: dir.fileToCreate(LabFile.MAKEFILE, () => [
                        "CC = gcc",
                        "CFLAGS = -std=c11 -g -ggdb -Wall -Werror -Wextra -O3 -march=native -flto",
                        "LFLAGS = -g -flto",
                        "LDFLAGS = -lm",
                        "",
                        "MAIN = main",
                        "",
                        "all: \${MAIN}",
                        "",
                        "",
                        "\${MAIN}: ",
                        "",
                        "",
                        "clean:\n\trm -rf *.o \${MAIN}",
                        "",
                    ].join("\n")),
                },
            };
        });
        const files = {
            cMakeListsTxt: dir.fileToCreate(LabFile.CMAKE_LISTS, cMakeListsTxt(name)),
            makeFile: dir.fileToCreate(LabFile.MAKEFILE, () => {
                const partNames = parts.map(part => part.name);
                const addPrefix = (prefix) => (name) => `${prefix}${utils_1.capitalize(name)}`;
                const prefixParts = (prefix) => partNames.map(addPrefix(prefix)).join(" ");
                const rule = (prefix, command = prefix) => (name) => `${addPrefix(prefix)(name)}:\n\tcd ${name}; make ${command}`;
                const sync = syncCommand(".");
                return [
                    `all: ${prefixParts("make")}`,
                    `clean: ${prefixParts("clean")}`,
                    ...partNames.map(rule("make", "all")),
                    ...partNames.map(rule("clean")),
                    `run:\n\t./\${MAIN_OUT}`,
                    `valgrind:\n\tvalgrind --leak-check=yes ./\${MAIN_OUT}`,
                    `pull:\n\t${sync(false)}`,
                    `push:\n\t${sync(true)}`,
                    `submit:\n\t/home/w3157/submit/submit-lab ${name}`,
                    "",
                ].join("\n\n");
            }),
            git: dir.dir(LabFile.GIT).ensureCreated(),
            gitIgnore: dir.fileToCreate(LabFile.GITIGNORE, () => [
                LabFile.IDEA,
                LabFile.CMAKE_LISTS,
                LabFile.CMAKE_BUILD_DEBUG,
                "",
                instructionsFileName,
                LabFile.SUBMISSION,
                `${name}-[0-9]*-[0-9]*-[0-9]*-[0-9]*`,
                "",
                LabFile.OBJECT_FILES,
                LabFile.EXE_FILES,
            ].join("\n")),
            // TODO check README extension .txt or .md
            readMe: dir.fileToCreate("README.txt", () => [
                "Khyber Sen",
                "UNI: ks3343",
                `Lab ${number}`,
                "",
                "_".repeat(80),
                "",
                "Description of Solution",
                "",
                "My code works exactly as specified in the lab.",
                "",
                ...parts.map(part => `Part ${part.number}\n\n    \n\n`),
            ].join("\n")),
            instructions: dir.fileToCreate(instructionsFileName, async () => {
                return (await fs.readFile(instructionsPath)).toString();
            }),
            clonedRepo: dir.dir("skeleton").ensureCreated(),
        };
        const createParts = async () => {
            await parts.asyncForEach(async (part) => {
                await part.dir.create();
                await filesCreator(part.files)();
            });
        };
        const createFiles = async () => {
            await filesCreator(files)();
            await createParts();
        };
        const cleanUp = async () => {
            const tempDir = `${dir.path}~`;
            await fs.move(dir.path, tempDir);
            await fs.mkdir(dir.path);
            await fs.move(tempDir, files.clonedRepo.path);
            await fs.move(files.clonedRepo.dir(".git").path, files.git.path);
        };
        const clone = async () => {
            const command = `git clone ${remoteName}:/home/jae/cs3157-pub/${name} ${dir.path}`;
            // git clone ks3343@clac.cs.columbia.edu:/home/jae/cs3157-pub/labN labN
            await runCommand_1.runCommand(command);
        };
        const clean = () => runCommand_1.runCommand("make clean", { cwd: dir.path });
        const sync = async (toRemote) => {
            const command = syncCommand(dir.path)(toRemote);
            // rsync -az ${dir} ks3343@clac.cs.columbia.edu:${remoteDir}
            await runCommand_1.runCommand(command);
        };
        const submit = async () => {
            const remoteCommands = [
                `/home/w3157/submit/submit-lab ${name}`,
            ];
            const command = `echo "${remoteCommands.join(" && ")}" | ssh ${remote}`;
            // echo "command" | ssh ks3343@clac.cs.columbia.edu:${remoteDir}
            await runCommand_1.runCommand(command);
        };
        return {
            number,
            name,
            dir,
            parts,
            files,
            create: async () => {
                await clone();
                await cleanUp();
                await createFiles();
            },
            submit: async () => {
                await clean();
                await sync(true);
                // don't run remote submit, I'll do that myself
                // await submit();
            },
        };
    },
    async fromInstructions(options) {
        const { instructionsPath, parentDir, remote } = options;
        const { number, partNumbers } = await LabInstructions_1.LabInstructions.from(instructionsPath);
        return exports.Lab.new({
            number,
            partNumbers,
            instructionsPath,
            parentDir,
            remote,
        });
    },
};
//# sourceMappingURL=Lab.js.map