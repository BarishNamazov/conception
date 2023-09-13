import {
  BulkWriteOptions,
  Collection,
  Condition,
  CountDocumentsOptions,
  DeleteOptions,
  DeleteResult,
  Document,
  Filter,
  FindOneAndUpdateOptions,
  FindOptions,
  InsertManyResult,
  InsertOneResult,
  ObjectId,
  OptionalUnlessRequiredId,
  ReplaceOptions,
  UpdateResult,
  WithId,
  WithoutId,
} from "mongodb";

import db from "../db";

export interface BaseDoc {
  _id: ObjectId;
  dateCreated: Date;
  dateUpdated: Date;
}

export type WithoutBase<T extends BaseDoc> = Omit<T, keyof BaseDoc>;

export default class DocCollection<Schema extends BaseDoc> {
  protected readonly collection: Collection<Schema>;
  private static collectionNames: Set<string> = new Set();

  constructor(public readonly name: string) {
    if (DocCollection.collectionNames.has(name)) {
      throw new Error(`Collection '${name}' already exists!`);
    }
    this.collection = db.collection(name);
  }

  /**
   * This method removes "illegal" fields from an item
   * so the client cannot fake them.
   */
  private sanitizeItem(item: Partial<Schema>) {
    delete item._id;
    delete item.dateCreated;
    delete item.dateUpdated;
  }

  /**
   * This method fixes the _id field of a filter.
   * In case the _id is a string, it will be converted to an ObjectId.
   */
  private sanitizeFilter(filter: Filter<Schema>) {
    if (filter._id && typeof filter._id === "string" && ObjectId.isValid(filter._id)) {
      filter._id = new ObjectId(filter._id) as Condition<WithId<Schema>["_id"]>;
    }
  }

  async createOne(item: Partial<Schema>): Promise<InsertOneResult> {
    this.sanitizeItem(item);
    item.dateCreated = new Date();
    item.dateUpdated = new Date();
    return await this.collection.insertOne(item as OptionalUnlessRequiredId<Schema>);
  }

  async createMany(items: Partial<Schema>[], options?: BulkWriteOptions): Promise<InsertManyResult> {
    items.forEach((item) => {
      this.sanitizeItem(item);
      item.dateCreated = new Date();
      item.dateUpdated = new Date();
    });
    return await this.collection.insertMany(items as OptionalUnlessRequiredId<Schema>[], options);
  }

  async readOne(filter: Filter<Schema>, options?: FindOptions): Promise<Schema | null> {
    this.sanitizeFilter(filter);
    return await this.collection.findOne<Schema>(filter, options);
  }

  async readMany(filter: Filter<Schema>, options?: FindOptions): Promise<Schema[]> {
    this.sanitizeFilter(filter);
    return await this.collection.find<Schema>(filter, options).toArray();
  }

  async replaceOne(filter: Filter<Schema>, item: Partial<Schema>, options?: ReplaceOptions): Promise<UpdateResult<Schema> | Document> {
    this.sanitizeFilter(filter);
    this.sanitizeItem(item);
    return await this.collection.replaceOne(filter, item as WithoutId<Schema>, options);
  }

  async updateOne(filter: Filter<Schema>, update: Partial<Schema>, options?: FindOneAndUpdateOptions): Promise<UpdateResult<Schema>> {
    this.sanitizeItem(update);
    this.sanitizeFilter(filter);
    update.dateUpdated = new Date();
    return await this.collection.updateOne(filter, { $set: update }, options);
  }

  async deleteOne(filter: Filter<Schema>, options?: DeleteOptions): Promise<DeleteResult> {
    this.sanitizeFilter(filter);
    return await this.collection.deleteOne(filter, options);
  }

  async deleteMany(filter: Filter<Schema>, options?: DeleteOptions): Promise<DeleteResult> {
    this.sanitizeFilter(filter);
    return await this.collection.deleteMany(filter, options);
  }

  async count(filter: Filter<Schema>, options?: CountDocumentsOptions): Promise<number> {
    this.sanitizeFilter(filter);
    return await this.collection.countDocuments(filter, options);
  }

  async popOne(filter: Filter<Schema>): Promise<Schema | null> {
    this.sanitizeFilter(filter);
    const one = await this.readOne(filter);
    if (one === null) {
      return null;
    }
    await this.deleteOne({ _id: one._id } as Filter<Schema>);
    return one;
  }
}
