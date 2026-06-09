/**
 * Library module model registry — register Library before Branch.
 */
import { LibraryModel } from './library.model';
import { BranchModel } from './branch.model';

export { LibraryModel } from './library.model';
export { BranchModel } from './branch.model';
export type { ILibrary, ILibraryDocument, ILibraryModel } from './library.model';
export type { IBranch, IBranchDocument, IBranchModel } from './branch.model';

export const __libraryRegisteredModels = [LibraryModel.modelName, BranchModel.modelName] as const;
