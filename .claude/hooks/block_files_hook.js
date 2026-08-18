async function main() {
    const chunks = [];

    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }

    const input = JSON.parse(Buffer.concat(chunks).toString());

    // Block Read/Grep tool calls (PreToolUse event)
    const readPath =
        input.tool_input?.file_path ||
        input.tool_input?.path ||
        "";

    if (readPath.includes("users.json")) {
        console.error("You cannot read the users.json file");
        process.exit(2);
    }
}

main();
