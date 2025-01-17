import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as gen from "io-ts-codegen";
import { OpenAPIV3 } from "openapi-types";
import { JsonPointer, JsonReference } from "./JSONReference";
import { toValidVariableName } from "../utils";
import { parseBodyObject } from "./body";
import { parsedItem, ParsedItem } from "./common";
import { modifyParserOutput, ParserContext, ParserRTE } from "./context";
import { parseParameterObject } from "./parameter";
import { parseResponseObject } from "./response";
import { parseSchema } from "./schema";

export function parseAllComponents(): ParserRTE<void> {
  return pipe(
    RTE.asks((context: ParserContext) => context.document.components),
    RTE.chain((components) => {
      const tasks: ParserRTE<void>[] = components
        ? createTasks(components)
        : [];
      return pipe(
        RTE.sequenceSeqArray(tasks),
        RTE.map(() => void 0)
      );
    })
  );
}

function createTasks(
  components: OpenAPIV3.ComponentsObject
): ParserRTE<void>[] {
  const pointer = new JsonPointer(["#", "components"]);

  const tasks: ParserRTE<void>[] = [];

  const { schemas, parameters, requestBodies, responses } = components;

  if (schemas) {
    tasks.push(parseAllSchemas(pointer, schemas));
  }

  if (parameters) {
    tasks.push(parseAllParameters(pointer, parameters));
  }

  if (requestBodies) {
    tasks.push(parseAllBodies(pointer, requestBodies));
  }

  if (responses) {
    tasks.push(parseAllResponses(pointer, responses));
  }

  return tasks;
}

function parseAllSchemas(
  componentsPointer: JsonPointer,
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>
): ParserRTE<void> {
  return pipe(
    Object.entries(schemas),
    RTE.traverseSeqArray(([name, schema]) => {
      const pointer = componentsPointer.concat(["schemas", name]);
      const generatedName = toValidVariableName(name, "pascal");

      return pipe(
        createSchemaComponent(generatedName, schema),
        RTE.fromEither,
        RTE.chain((component) =>
          modifyParserOutput((draft) => {
            draft.components.schemas[pointer.toString()] = component;
          })
        )
      );
    }),
    RTE.map(() => void 0)
  );
}

function createSchemaComponent(
  name: string,
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
): E.Either<Error, ParsedItem<gen.TypeDeclaration>> {
  return pipe(
    parseSchema(schema),
    E.map((type) => parsedItem(gen.typeDeclaration(name, type, true), name))
  );
}

function parseAllParameters(
  componentsPointer: JsonPointer,
  parameters: Record<
    string,
    OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject
  >
): ParserRTE<void> {
  const pointer = componentsPointer.concat(["parameters"]);

  return pipe(
    Object.entries(parameters),
    RTE.traverseSeqArray(([name, param]) =>
      parseParameterComponent(pointer, name, param)
    ),
    RTE.map(() => void 0)
  );
}

function parseParameterComponent(
  parametersPointer: JsonPointer,
  name: string,
  parameter: OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject
): ParserRTE<void> {
  if (JsonReference.is(parameter)) {
    return RTE.left(new Error("Found $ref in components/parameter"));
  }

  const pointer = parametersPointer.concat([name]);
  const generatedName = toValidVariableName(name, "camel");

  return pipe(
    parseParameterObject(generatedName, parameter),
    RTE.map((res) => parsedItem(res.item, generatedName)),
    RTE.chain((item) =>
      modifyParserOutput((draft) => {
        draft.components.parameters[pointer.toString()] = item;
      })
    )
  );
}

function parseAllBodies(
  componentsPointer: JsonPointer,
  bodies: Record<
    string,
    OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject
  >
): ParserRTE<void> {
  const pointer = componentsPointer.concat(["requestBodies"]);

  return pipe(
    Object.entries(bodies),
    RTE.traverseSeqArray(([name, body]) =>
      parseBodyComponent(pointer, name, body)
    ),
    RTE.map(() => void 0)
  );
}

function parseBodyComponent(
  bodiesPointer: JsonPointer,
  name: string,
  body: OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject
): ParserRTE<void> {
  if (JsonReference.is(body)) {
    return RTE.left(new Error("Found $ref in components/requestBodies"));
  }

  const pointer = bodiesPointer.concat([name]);
  const generatedName = toValidVariableName(name, "pascal");

  return pipe(
    parseBodyObject(generatedName, body),
    RTE.map((res) => parsedItem(res.item, generatedName)),
    RTE.chain((item) =>
      modifyParserOutput((draft) => {
        draft.components.requestBodies[pointer.toString()] = item;
      })
    )
  );
}

function parseAllResponses(
  componentsPointer: JsonPointer,
  responses: Record<
    string,
    OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject
  >
): ParserRTE<void> {
  const pointer = componentsPointer.concat(["responses"]);

  return pipe(
    Object.entries(responses),
    RTE.traverseSeqArray(([name, response]) =>
      parseResponseComponent(pointer, name, response)
    ),
    RTE.map(() => void 0)
  );
}

function parseResponseComponent(
  responsesPointer: JsonPointer,
  name: string,
  response: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject
): ParserRTE<void> {
  if (JsonReference.is(response)) {
    return RTE.left(new Error("Found $ref in components/responses"));
  }

  const pointer = responsesPointer.concat([name]);
  const generatedName = toValidVariableName("name", "camel");

  return pipe(
    parseResponseObject(generatedName, response),
    RTE.map((res) => parsedItem(res.item, generatedName)),
    RTE.chain((item) =>
      modifyParserOutput((draft) => {
        draft.components.responses[pointer.toString()] = item;
      })
    )
  );
}
