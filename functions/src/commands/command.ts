export interface CommandOption {
    name: string;
    description: string;
    type: number;
    required?: boolean;
    // Add more fields as needed (choices, etc.)
}

export interface CommandData {
    name: string;
    description: string;
    type: number;
    options?: CommandOption[];
}

export abstract class Command {
    public abstract data: CommandData;
    constructor() {}
    abstract execute(interaction: any, res: any, token: string): Promise<void>;
} 