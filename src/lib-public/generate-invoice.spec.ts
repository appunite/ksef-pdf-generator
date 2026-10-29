import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as FA1Generator from './FA1-generator';
import * as FA2Generator from './FA2-generator';
import * as FA3Generator from './FA3-generator';
import * as PEFBasicGenerator from './PEF-basic-generator';
import { buildInvoiceDocDefinition, generateInvoice } from './generate-invoice';
import { AdditionalDataTypes } from './types/common.types';
import * as XMLParser from '@shared//XML-parser';

describe('generateInvoice', () => {
  const mockBlob = new Blob(['mock pdf content'], { type: 'application/pdf' });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const additionalData: AdditionalDataTypes = {
    nrKSeF: 'testKSeF',
    qrCode: 'qrCodeValue',
    isMobile: false,
  };

  it('should call generateFA1 and resolve with blob for version FA (1)', async () => {
    const fakeXml = {
      Faktura: {
        Naglowek: {
          KodFormularza: {
            _attributes: { kodSystemowy: 'FA (1)' },
          },
        },
      },
    };

    vi.spyOn(XMLParser, 'parseXML').mockResolvedValue(fakeXml);

    const getBlobMock = vi.fn(() => Promise.resolve(mockBlob));

    vi.spyOn(FA1Generator, 'generateFA1').mockReturnValue({ getBlob: getBlobMock } as any);

    const file = new File([], 'test.xml');

    const result = await generateInvoice(file, additionalData, 'blob');

    expect(result).toBe(mockBlob);
    expect(XMLParser.parseXML).toHaveBeenCalledWith(file);
    expect(FA1Generator.generateFA1).toHaveBeenCalledWith(fakeXml.Faktura, additionalData);
    expect(getBlobMock).toHaveBeenCalled();
  });

  it('should call generateFA2 and resolve with blob for version FA (2)', async () => {
    const fakeXml = {
      Faktura: {
        Naglowek: {
          KodFormularza: {
            _attributes: { kodSystemowy: 'FA (2)' },
          },
        },
      },
    };

    vi.spyOn(XMLParser, 'parseXML').mockResolvedValue(fakeXml);

    const getBlobMock = vi.fn(() => Promise.resolve(mockBlob));

    vi.spyOn(FA2Generator, 'generateFA2').mockReturnValue({ getBlob: getBlobMock } as any);

    const file = new File([], 'test.xml');

    const result = await generateInvoice(file, additionalData, 'blob');

    expect(result).toBe(mockBlob);
    expect(XMLParser.parseXML).toHaveBeenCalledWith(file);
    expect(FA2Generator.generateFA2).toHaveBeenCalledWith(fakeXml.Faktura, additionalData);
    expect(getBlobMock).toHaveBeenCalled();
  });

  it('should call generateFA3 and resolve with blob for version FA (3)', async () => {
    const fakeXml = {
      Faktura: {
        Naglowek: {
          KodFormularza: {
            _attributes: { kodSystemowy: 'FA (3)' },
          },
        },
      },
    };

    vi.spyOn(XMLParser, 'parseXML').mockResolvedValue(fakeXml);

    const getBlobMock = vi.fn(() => Promise.resolve(mockBlob));

    vi.spyOn(FA3Generator, 'generateFA3').mockReturnValue({ getBlob: getBlobMock } as any);

    const file = new File([], 'test.xml');

    const result = await generateInvoice(file, additionalData, 'blob');

    expect(result).toBe(mockBlob);
    expect(XMLParser.parseXML).toHaveBeenCalledWith(file);
    expect(FA3Generator.generateFA3).toHaveBeenCalledWith(fakeXml.Faktura, additionalData);
    expect(getBlobMock).toHaveBeenCalled();
  });
});

describe('buildInvoiceDocDefinition', () => {
  const docDefinition = { content: ['doc'] } as any;
  const additionalData: AdditionalDataTypes = { nrKSeF: 'testKSeF', qrCode: 'qrCodeValue' };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return the FA (3) document definition without rendering a PDF', async () => {
    const fakeXml = { Faktura: { Naglowek: { KodFormularza: { _attributes: { kodSystemowy: 'FA (3)' } } } } };

    vi.spyOn(XMLParser, 'parseXML').mockResolvedValue(fakeXml);
    vi.spyOn(FA3Generator, 'buildFA3DocDefinition').mockReturnValue(docDefinition);
    vi.spyOn(FA3Generator, 'generateFA3');

    const file = new File([], 'test.xml');

    await expect(buildInvoiceDocDefinition(file, additionalData)).resolves.toBe(docDefinition);
    expect(FA3Generator.buildFA3DocDefinition).toHaveBeenCalledWith(fakeXml.Faktura, additionalData);
    expect(FA3Generator.generateFA3).not.toHaveBeenCalled();
  });

  it('should route a PEF invoice by its profile', async () => {
    const fakeXml = { Invoice: { ProfileID: { _text: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0' } } };

    vi.spyOn(XMLParser, 'parseXML').mockResolvedValue(fakeXml);
    vi.spyOn(PEFBasicGenerator, 'buildBasicPEFDocDefinition').mockReturnValue(docDefinition);

    await expect(buildInvoiceDocDefinition(new File([], 'test.xml'), additionalData)).resolves.toBe(
      docDefinition
    );
    expect(PEFBasicGenerator.buildBasicPEFDocDefinition).toHaveBeenCalledWith(
      fakeXml.Invoice,
      additionalData
    );
  });

  it('should reject an unknown version as generateInvoice does', async () => {
    vi.spyOn(XMLParser, 'parseXML').mockResolvedValue({ Faktura: {} });

    await expect(buildInvoiceDocDefinition(new File([], 'test.xml'), additionalData)).rejects.toThrow(
      'Unknown XML Version: undefined'
    );
  });
});
