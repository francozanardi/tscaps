import { Template } from "@core/templates/domain/Template";

export default interface TemplateLoader {
    load(name: string): Promise<Template>;
}
